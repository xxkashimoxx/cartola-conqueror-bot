import {hasOwnerSession} from "../server/owner.js";
// Server-only Cartola API. Requires DATABASE_URL on Vercel (never VITE_DATABASE_URL).
import { neon } from "@neondatabase/serverless";
import { createRemoteJWKSet, jwtVerify } from "jose";

const DATABASE_URL = process.env.DATABASE_URL;
const JWKS_URL = process.env.NEON_AUTH_JWKS_URL;
function db() {
  if (!DATABASE_URL) throw new Error("DATABASE_URL não configurada na Vercel");
  return neon(DATABASE_URL);
}
function json(res: any, status: number, payload: unknown) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(payload);
}
const integer = (v: unknown, fallback: number, max = 100) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : fallback;
};
async function cartola(path: string) {
  const response = await fetch("https://api.cartolafc.globo.com/" + path, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(18000),
  });
  if (!response.ok) throw new Error("Cartola FC indisponível (" + response.status + ", " + path + ")");
  return response.json();
}
async function authorizeAdmin(req: any) {
  if (hasOwnerSession(req)) return true;
  const secret = process.env.CRON_SECRET;
  if (secret && String(req.headers.authorization || "") === "Bearer " + secret) return true;
  if (!JWKS_URL) throw new Error("NEON_AUTH_JWKS_URL não configurada");
  const match = /^Bearer (.+)$/i.exec(String(req.headers.authorization || ""));
  if (!match) return false;
  try {
    const { payload } = await jwtVerify(match[1], createRemoteJWKSet(new URL(JWKS_URL)), {
      algorithms: ["ES256", "RS256", "EdDSA"],
    });
    if (!payload.sub) return false;
    const rows = await db().query(
      "select 1 from public.user_roles where user_id::text=$1 and role='admin' limit 1",
      [payload.sub],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}
async function topPlayers(limit: number, position?: number) {
  const rows = await db().query(`
    select a.*,c.nome as clube_nome,c.abreviacao as clube_sigla,c.escudo_url,
      p.nome as pos_nome,p.abreviacao as pos_sigla,
      coalesce((select jsonb_agg(jsonb_build_object('rodada',r.rodada,'pontos',r.pontos) order by r.rodada desc)
      from (select rodada,pontos from public.atleta_pontuacoes h where h.atleta_id=a.id order by rodada desc limit 10) r),'[]'::jsonb) as historico
    from public.atletas a
    left join public.clubes c on c.id=a.clube_id
    left join public.posicoes p on p.id=a.posicao_id
    where a.jogos>2 and a.media is not null and ($1::integer is null or a.posicao_id=$1)
    order by a.media desc nulls last limit 1200
  `, [position ?? null]);
  const scored = rows.map((a: any) => {
    const historico = Array.isArray(a.historico) ? a.historico : [];
    const points = historico.map((r: any) => Number(r.pontos) || 0);
    const average = Number(a.media) || 0;
    const sum = points.reduce((x: number, y: number) => x + y, 0);
    const sampleAverage = points.length ? sum / points.length : average;
    const deviation = points.length > 1 ?
      Math.sqrt(points.reduce((x: number, y: number) => x + Math.pow(y - sampleAverage, 2), 0) / points.length) : 0;
    const weighted = historico.length ?
      historico.reduce((t: number, r: any, i: number) => t + (Number(r.pontos) || 0) * Math.max(1, 10 - i), 0) /
      historico.reduce((t: number, _r: any, i: number) => t + Math.max(1, 10 - i), 0) : average;
    const regularity = points.length ? 100 * points.filter((x: number) => x > 0).length / points.length : 0;
    const consistency = Math.max(0, 100 - (average > 0 ? deviation / average : 1) * 50);
    const recent = points.slice(0, 5), previous = points.slice(5, 10);
    const diff = previous.length ? recent.reduce((a: number,b: number)=>a+b,0)/recent.length -
      previous.reduce((a: number,b: number)=>a+b,0)/previous.length : 0;
    const trend = diff > 1.5 ? "up" : diff < -1.5 ? "down" : "stable";
    const positionFactor = a.posicao_id === 5 ? 1.05 : a.posicao_id === 4 ? 1.03 : a.posicao_id === 1 ? .95 : 1;
    const potential = (weighted*4 + consistency*.25 + regularity*.2 + Math.min(10,(Number(a.jogos)||0)*.3)
      + (trend==="up"?5:trend==="down"?-3:0) + Math.min(5, average/Math.max(1,Number(a.preco)||1)*.5)) * positionFactor;
    const probability = points.length ? 100*points.filter((p: number)=>p>average).length/points.length : 50;
    return {
      id:a.id, name:a.apelido, fullName:a.nome, position:a.pos_nome || "Desconhecido",
      positionAbbr:a.pos_sigla || "N/A",team:a.clube_sigla || "N/A",teamName:a.clube_nome || "Desconhecido",
      shield:a.escudo_url,photo:a.foto_url,price:Number(a.preco)||0,
      predictedScore:Number(weighted.toFixed(2)),probability:Number(Math.max(40,Math.min(95,probability)).toFixed(1)),
      trend,average,games:Number(a.jogos)||0,totalPoints:Number(a.pontos_num)||0,
      potentialScore:Number(potential.toFixed(2)),consistency:Number(consistency.toFixed(1)),
      regularity:Number(regularity.toFixed(1)),weightedAverage:Number(weighted.toFixed(2)),historico,
    };
  }).sort((a:any,b:any)=>b.potentialScore-a.potentialScore).slice(0,limit);
  return {success:true,data:scored.map((a:any,i:number)=>({...a,rank:i+1})),count:scored.length};
}
async function syncMain(body: any) {
  const sql = db();
  const mercado:any = await cartola("mercado/status");
  if (!Number.isInteger(mercado.rodada_atual)) throw new Error("Cartola retornou rodada inválida");
  const source:any = await cartola("atletas/mercado");
  const clubs = Object.values(source.clubes || {}).map((c:any)=>({
    id:Number(c.id),nome:String(c.nome),abreviacao:String(c.abreviacao),
    escudo_url:c.escudos?.["60x60"] || null,
  })).filter((x:any)=>Number.isSafeInteger(x.id));
  if (!clubs.length) throw new Error("Não houve clubes na resposta oficial; sincronização cancelada");
  await sql.query(`
    insert into public.clubes(id,nome,abreviacao,escudo_url)
    select id,nome,abreviacao,escudo_url
    from jsonb_to_recordset($1::jsonb) as x(id int,nome text,abreviacao text,escudo_url text)
    on conflict(id) do update set nome=excluded.nome,abreviacao=excluded.abreviacao,
      escudo_url=excluded.escudo_url,updated_at=now()
  `,[JSON.stringify(clubs)]);
  const clubIds = new Set(clubs.map((c:any)=>c.id));
  const athletes = Object.values(source.atletas || {}).map((a:any)=>({
    id:Number(a.atleta_id),nome:String(a.nome || a.apelido),apelido:String(a.apelido||a.nome),
    clube_id:clubIds.has(Number(a.clube_id)) ? Number(a.clube_id) : null,
    posicao_id:Number(a.posicao_id) >= 1 && Number(a.posicao_id) <= 6 ? Number(a.posicao_id):null,
    preco:Number(a.preco_num)||0,variacao_preco:Number(a.variacao_num)||0,
    media:Number(a.media_num)||0,jogos:Number(a.jogos_num)||0,pontos_num:Number(a.pontos_num)||0,
    foto_url:a.foto||null,status_id:a.status_id==null?null:Number(a.status_id),
  })).filter((a:any)=>Number.isSafeInteger(a.id));
  for(let i=0;i<athletes.length;i+=300) {
    await sql.query(`
      insert into public.atletas
      (id,nome,apelido,clube_id,posicao_id,preco,variacao_preco,media,jogos,pontos_num,foto_url,status_id)
      select id,nome,apelido,clube_id,posicao_id,preco,variacao_preco,media,jogos,pontos_num,foto_url,status_id
      from jsonb_to_recordset($1::jsonb) as x(id int,nome text,apelido text,clube_id int,posicao_id int,
        preco numeric,variacao_preco numeric,media numeric,jogos int,pontos_num numeric,foto_url text,status_id int)
      on conflict(id) do update set nome=excluded.nome,apelido=excluded.apelido,clube_id=excluded.clube_id,
      posicao_id=excluded.posicao_id,preco=excluded.preco,variacao_preco=excluded.variacao_preco,
      media=excluded.media,jogos=excluded.jogos,pontos_num=excluded.pontos_num,
      foto_url=excluded.foto_url,status_id=excluded.status_id,updated_at=now()
    `,[JSON.stringify(athletes.slice(i,i+300))]);
  }
  await sql.query(`insert into public.mercado_status(rodada_atual,status_mercado,fechamento)
    values($1,$2,$3)`,[mercado.rodada_atual,mercado.status_mercado,
    mercado.fechamento?.timestamp?new Date(mercado.fechamento.timestamp*1000).toISOString():null]);

  // Fill up to eight missing historical rounds per request to stay within free runtime limits.
  const counts = await sql.query("select rodada,count(*)::int as n from public.atleta_pontuacoes group by rodada",[]);
  const completed = new Set(counts.filter((r:any)=>Number(r.n)>=150).map((r:any)=>Number(r.rodada)));
  const force = body?.force===true;
  const explicit = Array.isArray(body?.rodadas) ? body.rodadas.filter((x:any)=>Number.isInteger(x)&&x>=1&&x<mercado.rodada_atual) : [];
  const pending = explicit.length ? explicit : Array.from({length:Math.max(0,mercado.rodada_atual-1)},(_v,i)=>i+1)
    .filter(r=>force||!completed.has(r)||r===mercado.rodada_atual-1);
  // Atualizar rodadas recentes antes do histórico antigo (reta final de 2026).
  const rounds = pending.slice().sort((a,b)=>b-a).slice(0,8);
  let pointsSaved=0,roundsSaved=0;
  for(const round of rounds) {
    try {
      const resp:any=await cartola("atletas/pontuados/"+round);
      const pointRows=Object.entries(resp.atletas||{}).map(([id,a]:[string,any])=>({
        atleta_id:Number(id),rodada:round,pontos:Number(a.pontuacao)||0,
        preco:a.preco_num==null?null:Number(a.preco_num),
      })).filter((a:any)=>Number.isSafeInteger(a.atleta_id));
      for(let i=0;i<pointRows.length;i+=300) {
        await sql.query(`
          insert into public.atleta_pontuacoes(atleta_id,rodada,pontos,preco)
          select r.atleta_id,r.rodada,r.pontos,r.preco
          from jsonb_to_recordset($1::jsonb) as r(atleta_id int,rodada int,pontos numeric,preco numeric)
          where exists(select 1 from public.atletas a where a.id=r.atleta_id)
          on conflict(atleta_id,rodada) do update set pontos=excluded.pontos,preco=excluded.preco
        `,[JSON.stringify(pointRows.slice(i,i+300))]);
      }
      if(pointRows.length) {pointsSaved+=pointRows.length;roundsSaved++;}
    }catch(err){console.error("Falha em pontuação da rodada "+round,err);}
  }
  let matchesSaved=0;
  const matchRounds = [...new Set([mercado.rodada_atual-1,mercado.rodada_atual,mercado.rodada_atual+1])]
    .filter((r:number)=>r>=1&&r<=38);
  for(const round of matchRounds) {
    try {
      const matches:any=await cartola("partidas/"+round);
      const rows=(matches.partidas||[]).filter((p:any)=>
          clubIds.has(Number(p.clube_casa_id)) && clubIds.has(Number(p.clube_visitante_id)))
        .map((p:any)=>({rodada:round,time_casa_id:Number(p.clube_casa_id),
          time_fora_id:Number(p.clube_visitante_id),
          data_partida:p.partida_data?new Date(String(p.partida_data).replace(" ","T")+"-03:00").toISOString():null,
          placar_casa:p.placar_oficial_mandante??null,placar_fora:p.placar_oficial_visitante??null,
          status_jogo:p.status_transmissao_tr||null,posicao_casa:p.clube_casa_posicao??null,
          posicao_fora:p.clube_visitante_posicao??null,estadio:p.local||null,partida_cartola_id:p.partida_id??null}));
      if (!rows.length) continue;
      await sql.query(`
        insert into public.partidas(rodada,time_casa_id,time_fora_id,data_partida,
          placar_casa,placar_fora,status_jogo,posicao_casa,posicao_fora,estadio,partida_cartola_id)
        select rodada,time_casa_id,time_fora_id,data_partida,
          placar_casa,placar_fora,status_jogo,posicao_casa,posicao_fora,estadio,partida_cartola_id
        from jsonb_to_recordset($1::jsonb) as p(rodada int,time_casa_id int,time_fora_id int,data_partida timestamptz,
          placar_casa int,placar_fora int,status_jogo text,posicao_casa int,posicao_fora int,estadio text,partida_cartola_id int)
        on conflict(rodada,time_casa_id,time_fora_id) do update set data_partida=excluded.data_partida,
          placar_casa=excluded.placar_casa,placar_fora=excluded.placar_fora,status_jogo=excluded.status_jogo,
          posicao_casa=excluded.posicao_casa,posicao_fora=excluded.posicao_fora,estadio=excluded.estadio,
          partida_cartola_id=excluded.partida_cartola_id,updated_at=now()
      `,[JSON.stringify(rows)]);
      matchesSaved+=rows.length;
    }catch(err){console.error("Falha nas partidas "+round,err);}
  }
  return {success:true,rodada:mercado.rodada_atual,clubes:clubs.length,atletas:athletes.length,
    pontuacoes:pointsSaved,rodadasAtualizadas:roundsSaved,partidas:matchesSaved,
    rodadasPendentes:Math.max(0,pending.length-rounds.length),temporada:mercado.temporada,
    stats:{athletes:athletes.length,clubs:clubs.length,rounds:roundsSaved,matches:matchesSaved},
    message:"Sincronização parcial/concluída; consulte rodadasPendentes"};
}
async function syncPartial() {
  const mercado:any=await cartola("mercado/status");
  const response:any=await cartola("atletas/pontuados");
  const sql=db();
  const round=mercado.rodada_atual;
  const rows=Object.entries(response.atletas||{}).map(([id,a]:[string,any])=>({
    atleta_id:Number(id),rodada:round,pontos:Number(a.pontuacao)||0,
    scout:a.scout||{},jogou:a.entrou_em_campo===true||a.entrou_em_campo===1,
  })).filter((x:any)=>Number.isSafeInteger(x.atleta_id));
  for(let i=0;i<rows.length;i+=300) {
    await sql.query(`
      insert into public.atleta_parciais(atleta_id,rodada,pontos,scout,jogou)
      select atleta_id,rodada,pontos,scout,jogou
      from jsonb_to_recordset($1::jsonb) as x(atleta_id int,rodada int,pontos numeric,scout jsonb,jogou bool)
      on conflict(atleta_id,rodada) do update set pontos=excluded.pontos,scout=excluded.scout,
        jogou=excluded.jogou,atualizado_em=now()
    `,[JSON.stringify(rows.slice(i,i+300))]);
  }
  return {success:true,rodada:round,atletas:rows.length};
}
export default async function handler(req:any,res:any) {
  if(req.method==="OPTIONS") return res.status(204).end();
  const name=String(req.query?.name||"");
  const authorizedCron = (name==="sync-cartola-data" || name==="sync-parciais") && !!process.env.CRON_SECRET && req.headers.authorization==="Bearer "+process.env.CRON_SECRET;
  if(!authorizedCron && !hasOwnerSession(req)) return json(res,401,{success:false,error:"Faça login para continuar."});
  if(req.method!=="GET"&&req.method!=="POST") return json(res,405,{error:"Método inválido"});
  try {
    if(name==="status-temporada") {
      const m=await cartola("mercado/status");
      return json(res,200,{success:true,temporada:m.temporada,rodada:m.rodada_atual,rodadaFinal:m.rodada_final || 38,mercado:m.status_mercado,bolaRolando:!!m.bola_rolando,fechamento:m.fechamento,fonte:"Cartola FC - Globo",consultadoEm:new Date().toISOString()});
    }
    if(name==="get-top-players") return json(res,200,await topPlayers(
      integer(req.body?.limit ?? req.query?.limit,20,300),
      req.body?.posicao?integer(req.body.posicao,0,6):undefined));
    if(name==="sync-cartola-data" || name==="sync-parciais") {
      if(req.method!=="POST") return json(res,405,{error:"Use POST"});
      if(!await authorizeAdmin(req)) return json(res,403,{error:"Apenas administrador autenticado pode sincronizar"});
      return json(res,200,name==="sync-cartola-data"?await syncMain(req.body):await syncPartial());
    }
    return json(res,501,{error:"Função ainda não portada para o Neon: "+name});
  } catch(error) {
    console.error("API Cartola "+name,error);
    return json(res,500,{success:false,error:error instanceof Error?error.message:"Erro interno"});
  }
}

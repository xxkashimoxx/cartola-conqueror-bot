import { neon } from "@neondatabase/serverless";

// Backend de leitura analítica. Todos os dados vêm do Neon / Cartola 2026.
// Projeções são heurísticas, não fatos, recomendações oficiais ou garantia de valorização.
const sql = neon(process.env.DATABASE_URL || "");
const num = (v: any) => Number(v) || 0;
const limite = (v: any, max = 30) => Math.max(1, Math.min(max, Math.floor(num(v) || max)));
const atletaSql = "select a.*, c.nome as clube_nome,c.abreviacao as clube_sigla,c.escudo_url, p.nome as pos_nome,p.abreviacao as pos_sigla from public.atletas a left join public.clubes c on c.id=a.clube_id left join public.posicoes p on p.id=a.posicao_id";
const clube = (r: any) => ({id:r.clube_id,nome:r.clube_nome,abreviacao:r.clube_sigla,escudo_url:r.escudo_url});
const pos = (r:any) => ({id:r.posicao_id,nome:r.pos_nome,abreviacao:r.pos_sigla});
function atleta(r:any) {
  return {id:r.id,apelido:r.apelido,nome:r.nome,foto_url:r.foto_url,
    preco:num(r.preco),media:num(r.media),jogos:num(r.jogos),status_id:r.status_id,
    posicao_id:r.posicao_id,clube_id:r.clube_id,variacao_preco:num(r.variacao_preco),
    posicao:pos(r),clube:clube(r),escudo_url:r.escudo_url};
}
function reply(res:any,code:number,v:any){res.setHeader("Cache-Control","no-store");return res.status(code).json(v);}
async function rodadaAtual() {
  const r = await sql.query("select rodada_atual,status_mercado,fechamento,created_at from public.mercado_status order by created_at desc,id desc limit 1",[]);
  return r.length ? num(r[0].rodada_atual) : null;
}
async function partidas(round:number) {
  return sql.query("select p.*,jsonb_build_object('id',c.id,'nome',c.nome,'abreviacao',c.abreviacao,'escudo_url',c.escudo_url) time_casa,jsonb_build_object('id',v.id,'nome',v.nome,'abreviacao',v.abreviacao,'escudo_url',v.escudo_url) time_fora from public.partidas p left join public.clubes c on c.id=p.time_casa_id left join public.clubes v on v.id=p.time_fora_id where p.rodada=$1 order by p.data_partida asc nulls last", [round]);
}
function formatPartida(p:any) {
  return {...p,clean_sheet_casa:num(p.clean_sheet_casa),clean_sheet_fora:num(p.clean_sheet_fora),
    xg_casa:num(p.xg_casa),xg_fora:num(p.xg_fora)};
}
async function confrontos(body:any){
  const rodada=await rodadaAtual();
  if(!rodada)return {success:true,rodada:null,data:[],empty:true};
  const all=(await partidas(rodada)).map(formatPartida);
  const chosen = body?.id && all.find(x=>x.id===body.id);
  if(!chosen)return {success:true,rodada,data:all};
  const rows=await sql.query(atletaSql+" where a.clube_id in ($1,$2) and a.status_id=7 and a.jogos>=1 order by a.media desc nulls last limit 150",[chosen.time_casa_id,chosen.time_fora_id]);
  const take=(team:number,positions:number[])=>rows.filter((a:any)=>Number(a.clube_id)===team&&positions.includes(Number(a.posicao_id))).slice(0,4).map(atleta);
  const casa={defesa:take(chosen.time_casa_id,[1,2,3]),ataque:take(chosen.time_casa_id,[4,5])};
  const fora={defesa:take(chosen.time_fora_id,[1,2,3]),ataque:take(chosen.time_fora_id,[4,5])};
  return {success:true,rodada,data:{partida:chosen,recomendacoes:{casa,fora},
    nota:"Indicadores exploratórios calculados com médias do Cartola FC. Confirme os titulares e a escalação oficial antes de decidir."}};
}
async function ausencias() {
  const rodada=await rodadaAtual();
  if(!rodada)return {success:true,rodada:null,data:[],empty:true};
  const rows=await sql.query(atletaSql+" where a.status_id in (2,3,5) order by a.media desc nulls last limit 180",[]);
  const manual=await sql.query("select au.*, a.apelido from public.ausencias au join public.atletas a on a.id=au.atleta_id where au.rodada=$1 order by au.probabilidade desc limit 100",[rodada]);
  const indexed=new Set(manual.map((x:any)=>x.atleta_id));
  const details=await sql.query(atletaSql+" where a.id=any($1::integer[])",[manual.map((x:any)=>x.atleta_id)]);
  const byId=new Map(details.map((x:any)=>[x.id,x]));
  const hand=manual.filter((a:any)=>byId.has(a.atleta_id)).map((a:any)=>({
    id:a.id,atleta:atleta(byId.get(a.atleta_id)),tipo:a.tipo,nota:a.nota,
    probabilidade:num(a.probabilidade),fonte:"manual"}));
  const status:{[k:number]:string}={2:"DESCANSO",3:"SUSPENSAO",5:"LESAO"};
  return {success:true,rodada,data:[...hand,...rows.filter((r:any)=>!indexed.has(r.id)).map((r:any)=>({
    id:"cartola-"+r.id,atleta:atleta(r),tipo:status[r.status_id],
    nota:r.status_id===3?"Suspenso":r.status_id===5?"Contundido":"Dúvida sobre disponibilidade",
    probabilidade:r.status_id===3?1:r.status_id===5?.95:.6,fonte:"cartola"
  }))]};
}
async function oportunidades(){
  const rodada=await rodadaAtual();
  if(!rodada)return {success:true,rodada:null,oportunidades:[],data:[],empty:true};
  const rows=await sql.query(atletaSql+" where a.status_id=7 and a.jogos>=3 and a.preco>0 and a.media>0 order by a.media desc nulls last limit 1000",[]);
  const sorted=rows.map((r:any)=>({...r,score:num(r.media)/Math.max(1,num(r.preco)),m:num(r.media),price:num(r.preco)}));
  const bargains=sorted.filter((a:any)=>a.price<=8&&a.m>=4.2).sort((a:any,b:any)=>b.m-a.m).slice(0,5);
  const value=sorted.filter((a:any)=>!bargains.some((b:any)=>b.id===a.id)).sort((a:any,b:any)=>b.score-a.score).slice(0,5);
  const predicted=sorted.filter((a:any)=>!bargains.some((b:any)=>b.id===a.id)&&!value.some((b:any)=>b.id===a.id)).sort((a:any,b:any)=>b.m-a.m).slice(0,4);
  const toCard=(r:any,tipo:string,nota:string,score:number)=>({
    id:"auto-"+tipo+"-"+r.id,atleta_id:r.id,tipo,nota,score,
    atleta:{...atleta(r),clube:r.clube_sigla,posicao:r.pos_sigla},source:"auto"
  });
  const data=[
    ...bargains.map((x:any)=>toCard(x,"BARATO_EXPLOSAO","Preço C$ "+x.price.toFixed(2)+" e média "+x.m.toFixed(2),x.m)),
    ...value.map((x:any)=>toCard(x,"SUBESTIMADO","Relação média/preço de "+x.score.toFixed(2),x.score*10)),
    ...predicted.map((x:any)=>toCard(x,"APOSTA_DA_RODADA","Boa média histórica; confirme contexto e escalação.",x.m))
  ];
  return {success:true,rodada,data,oportunidades:data,metodologia:"Custo-benefício calculado com preços e médias oficiais; não é previsão garantida."};
}
async function mercadoInteligente(){
  const rodada=await rodadaAtual();
  if(!rodada)return {rodada:null,valorizar:[],desvalorizar:[],totalValorizar:0,totalDesvalorizar:0,empty:true};
  const matches=await partidas(rodada);
  const home=new Set(matches.map((p:any)=>p.time_casa_id));
  const away=new Set(matches.map((p:any)=>p.time_fora_id));
  const rows=await sql.query(atletaSql+" where a.jogos>2 and a.preco>0 and a.media is not null order by a.media desc nulls last limit 1000",[]);
  const decorate=(r:any,tipo:string,motivo:string)=>({...atleta(r),clube:r.clube_sigla,
    clube_nome:r.clube_nome,posicao:r.pos_sigla,posicao_nome:r.pos_nome,
    emCasa:home.has(r.clube_id),visitante:away.has(r.clube_id),tipo,motivo});
  const rise=rows.filter((r:any)=>r.status_id===7&&num(r.preco)<15)
    .map((r:any)=>({r,score:num(r.media)/Math.max(1,num(r.preco))+(home.has(r.clube_id)?.3:0)+Math.max(-.2,Math.min(.2,num(r.variacao_preco)/5))}))
    .sort((a:any,b:any)=>b.score-a.score);
  const fall=rows.filter((r:any)=>num(r.preco)>10&&(r.status_id!==7||num(r.variacao_preco)<0||num(r.media)<4))
    .map((r:any)=>({r,score:num(r.preco)/6-num(r.media)/4+(away.has(r.clube_id)?.5:0)+(r.status_id!==7?2:0)}))
    .sort((a:any,b:any)=>b.score-a.score);
  const valorizar=rise.slice(0,10).map((x:any)=>decorate(x.r,"valorizar","Custo-benefício histórico; valorização futura não é garantida"));
  const desvalorizar=fall.slice(0,10).map((x:any)=>decorate(x.r,"desvalorizar","Preço, média e situação do atleta indicam atenção"));
  return {success:true,rodada,valorizar,desvalorizar,totalValorizar:rise.length,totalDesvalorizar:fall.length,
    metodologia:"Heurística baseada em preço, média e situação; não substitui a fórmula oficial de valorização."};
}
async function simulador(body:any) {
  if(!Array.isArray(body?.teams)||body.teams.length<1||body.teams.length>3)throw new Error("Informe de 1 a 3 times.");
  const teams=body.teams.map((t:any)=>({
    name:String(t.name||"Time").slice(0,90),
    playerIds:[...new Set(Array.isArray(t.playerIds)?t.playerIds.filter((x:any)=>Number.isSafeInteger(x)&&x>0).slice(0,18):[])]
  }));
  const ids=[...new Set(teams.flatMap((t:any)=>t.playerIds))];
  const rows=ids.length?await sql.query(atletaSql+" where a.id=any($1::integer[])",[ids]):[];
  const dict=new Map(rows.map((r:any)=>[r.id,r]));
  const result=teams.map((t:any,i:number)=>{
    const ps=t.playerIds.map((id:number)=>dict.get(id)).filter(Boolean);
    let defense=0,midfield=0,attack=0,tech=0,price=0;
    const players=ps.map((r:any)=>{
      const p=atleta(r);price+=p.preco;
      if([1,2,3].includes(p.posicao_id))defense+=p.media;
      else if(p.posicao_id===4)midfield+=p.media;
      else if(p.posicao_id===5)attack+=p.media;else tech+=p.media;
      return {...p,clube:r.clube_sigla};
    });
    const rnd=(x:number)=>Math.round(x*100)/100;
    return {teamIndex:i,teamName:t.name,totalPrice:rnd(price),
      expectedPointsTotal:rnd(defense+midfield+attack+tech),
      sectors:{defense:rnd(defense),midfield:rnd(midfield),attack:rnd(attack),tech:rnd(tech)},players};
  });
  return {success:true,results:result,disclaimer:"Estimativas baseadas em médias passadas, não pontuação futura garantida."};
}
async function resumoRodada(){
  const rodada=await rodadaAtual();
  if(!rodada)return {success:false,error:"Dados da temporada ainda não sincronizados"};
  const matches=(await partidas(rodada)).map(formatPartida);
  const players=await sql.query(atletaSql+" where a.status_id=7 and a.jogos>3 and a.media>0 order by a.media desc nulls last limit 30",[]);
  const names=players.map((x:any)=>x.apelido);
  const jogos=matches.filter((x:any)=>x.time_casa?.abreviacao&&x.time_fora?.abreviacao).slice(0,3)
    .map((x:any)=>({jogo:x.time_casa.abreviacao+" x "+x.time_fora.abreviacao,analise:"Confronto da rodada; considere provável escalação, mando e desempenho recente."}));
  return {success:true,rodada,
    manchete:"Rodada "+rodada+" de 38: dados oficiais do Cartola 2026 e análise estatística",
    confrontos_principais:jogos,
    surpresas:[{titulo:"Reta final do Brasileirão",descricao:"Avalie a necessidade de pontos dos clubes e as ausências antes de escalar."}],
    escalacao_free:{resumo:"Destaques por média histórica, sem otimização de formação.",jogadores:names.slice(0,5)},
    escalacao_pro:{resumo:"Atletas com boas médias históricas; confira disponibilidade.",jogadores:names.slice(0,10),
      diferencial:"Atenção a suspensões, lesões e valorização: desempenho passado não garante pontos."},
    fonte:"Cartola FC / Neon",geradoEm:new Date().toISOString()};
}
const xml=(s:string)=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim();
async function noticias(body:any){
  const key="cartola-2026-brasileirao";
  const force=!!(body?.refresh);
  if(!force){
    const hit=await sql.query("select payload,fetched_at from public.news_cache where cache_key=$1 and source_ok=true and fetched_at>now()-interval '10 minutes' limit 1",[key]);
    if(hit.length)return {...hit[0].payload,cached:true};
  }
  let news:any[]=[];
  try {
    const u="https://ge.globo.com/rss/ge/cartola/";
    const req=await fetch(u,{signal:AbortSignal.timeout(10000),headers:{"User-Agent":"CartolaConqueror/2026 (news aggregator)"}});
    if(!req.ok)throw new Error("RSS indisponível ("+req.status+")");
    const bodyXml=await req.text();
    news=Array.from(bodyXml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).slice(0,24).map((m:any)=>{
      const x=m[1];
      const tag=(t:string)=>xml((x.match(new RegExp("<"+t+"(?: [^>]*)?>([\\s\\S]*?)<\\/"+t+">","i"))||[])[1]||"");
      return {title:tag("title"),link:tag("link"),description:tag("description").slice(0,700),pubDate:tag("pubDate"),image:null,source:"ge.globo.com/cartola"};
    }).filter((x:any)=>x.title&&x.link.startsWith("https://"));
  } catch(e) {
    console.error("Falha RSS Cartola",e);
    const stale=await sql.query("select payload from public.news_cache where cache_key=$1 limit 1",[key]);
    return {...(stale[0]?.payload||{news:[]}),stale:true,source_ok:false};
  }
  const payload={news,stale:false,source:"ge.globo.com/cartola",consultadoEm:new Date().toISOString()};
  await sql.query("insert into public.news_cache(cache_key,payload,fetched_at,source_ok) values($1,$2::jsonb,now(),true) on conflict(cache_key) do update set payload=excluded.payload,fetched_at=now(),source_ok=true",[key,JSON.stringify(payload)]);
  return payload;
}
export default async function handler(req:any,res:any){
  if(!["GET","POST"].includes(req.method))return reply(res,405,{error:"Método inválido"});
  const name=String(req.query?.name||"");
  try{
    const b=req.body||{};
    let data:any;
    switch(name){
      case "confrontos":data=await confrontos(b);break;
      case "ausencias":data=await ausencias();break;
      case "oportunidades":data=await oportunidades();break;
      case "mercado-inteligente":data=await mercadoInteligente();break;
      case "simulador":data=await simulador(b);break;
      case "resumo-rodada":data=await resumoRodada();break;
      case "news-brasileirao":data=await noticias(b);break;
      default:return reply(res,404,{success:false,error:"Função não encontrada"});
    }
    return reply(res,200,data);
  }catch(e){console.error("analytics/"+name,e);
    return reply(res,500,{success:false,error:e instanceof Error?e.message:"Erro interno"});}
}

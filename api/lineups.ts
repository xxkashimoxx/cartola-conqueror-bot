import {neon} from "@neondatabase/serverless";
import {OWNER_ID,ownerOnly} from "../server/owner.js";
const sql=neon(process.env.DATABASE_URL||"");
const numeric=(v:any)=>Number(v)||0;
export default async function handler(req:any,res:any){
 if(!ownerOnly(req,res))return;
 res.setHeader("Cache-Control","no-store");
 try{
  if(req.method==="GET"){
   const rodada=Math.floor(numeric(req.query?.rodada));
   const rows=rodada>0 ? await sql.query("select rodada,tipo,estrategia,atleta_ids,pontos_esperados,valor_total,updated_at from public.escalacoes_usuario where user_id=$1 and rodada=$2 order by updated_at desc",[OWNER_ID,rodada]):
    await sql.query("select rodada,tipo,estrategia,atleta_ids,pontos_esperados,valor_total,updated_at from public.escalacoes_usuario where user_id=$1 order by rodada desc,updated_at desc limit 100",[OWNER_ID]);
   return res.status(200).json({success:true,rows});
  }
  if(req.method!=="POST")return res.status(405).json({error:"Método inválido"});
  const rodada=Math.floor(numeric(req.body?.rodada));
  const estrategia=String(req.body?.estrategia||"");
  const mine=req.body?.mine,rec=req.body?.recommended;
  if(!Number.isInteger(rodada)||rodada<1||rodada>38||!["balanceada","ofensiva","defensiva"].includes(estrategia))
    return res.status(400).json({error:"Rodada ou estratégia inválida"});
  const valid=(obj:any)=>obj&&Array.isArray(obj.ids)&&obj.ids.length===12&&
   obj.ids.every((x:any)=>Number.isSafeInteger(x)&&x>0)&&new Set(obj.ids).size===12 &&
   numeric(obj.price)>0&&numeric(obj.price)<1001 && Math.abs(numeric(obj.score))<400;
  if(!valid(mine)||!valid(rec))return res.status(400).json({error:"Escalação deve ter 11 atletas e técnico, sem duplicações"});
  const list=[{tipo:"minha",data:mine},{tipo:"recomendada",data:rec}];
  for(const x of list){
   await sql.query(`insert into public.escalacoes_usuario(user_id,rodada,tipo,estrategia,atleta_ids,pontos_esperados,valor_total)
    values($1,$2,$3,$4,$5::integer[],$6,$7)
    on conflict(user_id,rodada,tipo) do update set estrategia=excluded.estrategia,
    atleta_ids=excluded.atleta_ids,pontos_esperados=excluded.pontos_esperados,
    valor_total=excluded.valor_total,updated_at=now()`,
    [OWNER_ID,rodada,x.tipo,estrategia,x.data.ids,numeric(x.data.score),numeric(x.data.price)]);
  }
  return res.status(200).json({success:true,rodada});
 }catch(e){console.error("Lineup storage",e);return res.status(500).json({error:"Erro ao carregar ou salvar escalações"})}
}
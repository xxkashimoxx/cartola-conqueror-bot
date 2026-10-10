import {neon} from "@neondatabase/serverless";
import {OWNER_ID,ownerOnly,safeOrigin} from "../server/owner.js";
import {scoringContext,scoreTeam} from "../server/scoring.js";

const sql=neon(process.env.DATABASE_URL||"");
const numeric=(v:unknown)=>Number(v)||0;
type RecordInput={ids:number[];price:number;score:number;captainId:number|null};
function valid(t:any):t is RecordInput {
 return t&&Array.isArray(t.ids)&&t.ids.length===12&&new Set(t.ids).size===12&&
  t.ids.every((id:any)=>Number.isSafeInteger(id)&&id>0)&&
  Number.isFinite(Number(t.price))&&Number(t.price)>0&&Number(t.price)<1001&&
  Number.isFinite(Number(t.score))&&Math.abs(Number(t.score))<600&&
  (t.captainId===null||(Number.isSafeInteger(t.captainId)&&t.ids.includes(t.captainId)));
}
function respond(res:any,status:number,data:any){res.setHeader("Cache-Control","private,no-store");return res.status(status).json(data);}
export default async function handler(req:any,res:any){
 if(!ownerOnly(req,res))return;
 try{
  if(req.method==="GET"){
   const rod=Math.floor(numeric(req.query?.rodada));
   const rows=rod>0?await sql.query(
    "select rodada,tipo,estrategia,atleta_ids,captain_id,pontos_esperados,valor_total,created_at,updated_at from public.escalacoes_usuario where user_id=$1 and rodada=$2 order by updated_at desc",
    [OWNER_ID,rod]):await sql.query(
    "select rodada,tipo,estrategia,atleta_ids,captain_id,pontos_esperados,valor_total,created_at,updated_at from public.escalacoes_usuario where user_id=$1 order by rodada desc,updated_at desc limit 100",
    [OWNER_ID]);
   // Score each round once. An API outage must not affect loading saved lineups.
   const contexts=new Map<number,any>();
   for(const rodada of [...new Set(rows.map((x:any)=>Number(x.rodada)))].slice(0,15)){
    try{contexts.set(rodada,await scoringContext(rodada));}catch(e){console.warn("Score unavailable",rodada,e);}
   }
   const hydrated=rows.map((x:any)=>{
    const ctx=contexts.get(Number(x.rodada));
    return {...x,pontos_esperados:numeric(x.pontos_esperados),valor_total:numeric(x.valor_total),
      score:ctx?scoreTeam(Number(x.rodada),x.atleta_ids,x.captain_id??null,ctx):null};
   });
   return respond(res,200,{success:true,rows:hydrated});
  }
  if(req.method!=="POST")return respond(res,405,{error:"Método inválido"});
  if(!safeOrigin(req))return respond(res,403,{error:"Origem da requisição inválida"});
  const rodada=Number(req.body?.rodada),estrategia=req.body?.estrategia;
  if(!Number.isSafeInteger(rodada)||rodada<1||rodada>38||
     !["balanceada","ofensiva","defensiva"].includes(estrategia))
   return respond(res,400,{error:"Rodada ou estratégia inválida"});
  const mine=req.body?.mine,rec=req.body?.recommended;
  if(!valid(mine))return respond(res,400,{error:"Meu Time precisa ter 12 integrantes válidos e um capitão escolhido."});
  if(rec!==undefined && rec!==null && !valid(rec))return respond(res,400,{error:"Sugestão inválida."});
  // This is the ONLY path that changes the user's saved team, after explicit Save.
  await sql.query(`insert into public.escalacoes_usuario
    (user_id,rodada,tipo,estrategia,atleta_ids,captain_id,pontos_esperados,valor_total)
    values($1,$2,'minha',$3,$4::integer[],$5,$6,$7)
    on conflict(user_id,rodada,tipo) do update set
      estrategia=excluded.estrategia,atleta_ids=excluded.atleta_ids,captain_id=excluded.captain_id,
      pontos_esperados=excluded.pontos_esperados,valor_total=excluded.valor_total,updated_at=now()`,
    [OWNER_ID,rodada,estrategia,mine.ids,mine.captainId,Number(mine.score),Number(mine.price)]);
  if(rec){
   await sql.query(`insert into public.escalacoes_usuario
    (user_id,rodada,tipo,estrategia,atleta_ids,captain_id,pontos_esperados,valor_total)
    values($1,$2,'recomendada',$3,$4::integer[],$5,$6,$7)
    on conflict(user_id,rodada,tipo) do update set
      estrategia=excluded.estrategia,atleta_ids=excluded.atleta_ids,captain_id=excluded.captain_id,
      pontos_esperados=excluded.pontos_esperados,valor_total=excluded.valor_total,updated_at=now()`,
    [OWNER_ID,rodada,estrategia,rec.ids,rec.captainId,Number(rec.score),Number(rec.price)]);
  }
  let score=null;
  try{score=scoreTeam(rodada,mine.ids,mine.captainId,await scoringContext(rodada));}catch(e){console.warn("Scoring temporarily unavailable",e);}
  return respond(res,200,{success:true,rodada,stored:true,atleta_ids:mine.ids,captain_id:mine.captainId,score});
 }catch(e){console.error("Lineups",e);return respond(res,500,{error:"Não foi possível recuperar ou salvar o time."});}
}

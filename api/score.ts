import {neon} from "@neondatabase/serverless";
import {ownerOnly,safeOrigin,OWNER_ID} from "../server/owner.js";
import {scoringContext,scoreTeam} from "../server/scoring.js";
const db=neon(process.env.DATABASE_URL||"");
export default async function handler(req:any,res:any){
 if(!ownerOnly(req,res))return;
 if(req.method!=="GET"&&req.method!=="POST")return res.status(405).json({error:"Método inválido"});
 if(req.method==="POST"&&!safeOrigin(req))return res.status(403).json({error:"Origem inválida"});
 const rodada=Number(req.method==="POST"?req.body?.rodada:req.query?.rodada);
 if(!Number.isSafeInteger(rodada)||rodada<1||rodada>38)return res.status(400).json({error:"Rodada inválida"});
 try{
  let ids:any,captainId:any;
  if(req.method==="GET"){
   const rows=await db.query("select atleta_ids,captain_id from public.escalacoes_usuario where user_id=$1 and rodada=$2 and tipo='minha' limit 1",[OWNER_ID,rodada]);
   if(!rows.length)return res.status(404).json({error:"Nenhum Meu Time salvo nesta rodada"});
   ids=rows[0].atleta_ids;captainId=rows[0].captain_id;
  }else{
   ids=req.body?.ids;captainId=req.body?.captainId??null;
  }
  if(!Array.isArray(ids)||ids.length!==12||ids.some((id:any)=>!Number.isSafeInteger(id)||id<=0)||new Set(ids).size!==12)
    return res.status(400).json({error:"Escalação inválida: são necessários 12 IDs diferentes"});
  if(captainId!==null&&(!Number.isSafeInteger(captainId)||!ids.includes(captainId)))
    return res.status(400).json({error:"Capitão precisa pertencer ao time"});
  const context=await scoringContext(rodada);
  const score=scoreTeam(rodada,ids,captainId,context);
  res.setHeader("Cache-Control","no-store,private");
  return res.status(200).json({success:true,...score});
 }catch(e){console.error("Scoreboard",e);return res.status(503).json({error:"Pontuação oficial temporariamente indisponível"});}
}
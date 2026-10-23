import {neon} from "@neondatabase/serverless";
import {OWNER_ID,verifyPassword,issueSession,hasOwnerSession,publicAppAccess,setOwnerCookie,clearOwnerCookie,safeOrigin,loginHash} from "../server/owner.js";
function reply(res:any,code:number,json:any){res.setHeader("Cache-Control","no-store, private");return res.status(code).json(json);}
export default async function handler(req:any,res:any){
 if(req.method==="GET")return reply(res,200,{authenticated:hasOwnerSession(req),publicAccess:publicAppAccess(),user:hasOwnerSession(req)?{id:OWNER_ID,role:"admin"}:null});
 if(req.method!=="POST"&&req.method!=="DELETE")return reply(res,405,{error:"Método não permitido"});
 if(!safeOrigin(req))return reply(res,403,{error:"Origem da requisição inválida"});
 if(req.method==="DELETE"){clearOwnerCookie(res);return reply(res,200,{success:true});}
 const sql=neon(process.env.DATABASE_URL||"");
 try{
  const key=loginHash(req);
  const updated=await sql.query(`insert into public.private_login_limits(client_hash,attempts,window_start)
     values($1,1,now()) on conflict(client_hash) do update
     set attempts=case when private_login_limits.window_start<now()-interval '15 minutes' then 1 else private_login_limits.attempts+1 end,
         window_start=case when private_login_limits.window_start<now()-interval '15 minutes' then now() else private_login_limits.window_start end
     returning attempts`,[key]);
  if(Number(updated[0]?.attempts)>5)return reply(res,429,{error:"Muitas tentativas. Tente novamente em 15 minutos."});
  if(!verifyPassword(req.body?.password))return reply(res,401,{error:"Senha inválida."});
  await sql.query("delete from public.private_login_limits where client_hash=$1",[key]);
  setOwnerCookie(res,issueSession());
  return reply(res,200,{success:true,user:{id:OWNER_ID,role:"admin"}});
 }catch(e){console.error("Erro de login:",e instanceof Error?e.message:"erro");
  return reply(res,503,{error:"Login temporariamente indisponível."});}
}

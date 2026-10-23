import {createHmac,timingSafeEqual,scryptSync,createHash,randomBytes} from "node:crypto";
export const OWNER_ID="00000000-0000-4000-8000-000000000001";
const COOKIE="__Host-cartola-owner";
const WEEK=7*24*60*60;
const secret=()=>process.env.OWNER_SESSION_KEY||"";
function sign(data:string) {if(!secret())throw new Error("OWNER_SESSION_KEY não configurado");return createHmac("sha256",secret()).update(data).digest("base64url");}
function b64(s:string){return Buffer.from(s).toString("base64url");}
function equals(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function verifyPassword(password:unknown):boolean {
 const saved=process.env.OWNER_PASSWORD_HASH;
 if(typeof password!=="string"||password.length>256||!saved)return false;
 const [salt,hash]=saved.split(":");
 if(!salt||!hash||!/^[\da-f]{32}$/.test(salt)||!/^[\da-f]{64}$/.test(hash))return false;
 const computed=scryptSync(password,Buffer.from(salt,"hex"),32,{N:16384,r:8,p:1});
 return timingSafeEqual(computed,Buffer.from(hash,"hex"));
}
export function issueSession():string {
 const payload=b64(JSON.stringify({sub:OWNER_ID,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+WEEK,nonce:randomBytes(12).toString("hex")}));
 return payload+"."+sign(payload);
}
export function hasOwnerSession(req:any):boolean{
 if(!secret())return false;
 const cookies=String(req.headers?.cookie||"").split(";").map((x:string)=>x.trim());
 const item=cookies.find((x:string)=>x.startsWith(COOKIE+"="));
 if(!item)return false;
 const token=item.slice(COOKIE.length+1);
 const split=token.lastIndexOf(".");
 if(split<0||token.length>1024)return false;
 const body=token.slice(0,split),mac=token.slice(split+1);
 if(!equals(mac,sign(body)))return false;
 try{const value=JSON.parse(Buffer.from(body,"base64url").toString());
  const now=Date.now()/1000;
  return value.sub===OWNER_ID&&Number.isSafeInteger(value.iat)&&Number.isSafeInteger(value.exp)&&value.iat<=now+60&&value.exp>now&&value.exp<=value.iat+WEEK+10;
 }catch{return false;}
}
// Temporary, server-controlled guest access. Never grants an owner session.
export const publicAppAccess=()=>process.env.PUBLIC_APP_ACCESS==="true";
export function setOwnerCookie(res:any,token:string,maxAge=WEEK){
 res.setHeader("Set-Cookie",COOKIE+"="+token+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+maxAge);
}
export function clearOwnerCookie(res:any){setOwnerCookie(res,"",0);}
export function ownerOnly(req:any,res:any):boolean {
 if(hasOwnerSession(req))return true;
 res.setHeader("Cache-Control","no-store");
 res.status(401).json({success:false,error:"Acesso restrito. Entre com a senha na tela de login."});
 return false;
}
export function safeOrigin(req:any){
 const origin=req.headers?.origin,host=req.headers?.host;
 if(!origin||!host)return false;
 try{return new URL(origin).host===host&&new URL(origin).protocol==="https:";}catch{return false;}
}
export function loginHash(req:any){
 const ip=String(req.headers?.["x-real-ip"]||req.headers?.["x-forwarded-for"]||"unknown").split(",")[0].trim();
 return createHash("sha256").update(secret()+"|"+ip).digest("hex");
}

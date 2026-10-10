// Legacy named import kept only for existing React pages.
// Neon Data API handles public statistics; the owner session is an HttpOnly signed cookie.
// No Supabase project, JWT or email login is used.
import {neon} from "@/integrations/neon/client";

type InvokeOptions={body?:unknown;headers?:Record<string,string>};
const CURRENT_OWNER_EVENT="cartola-auth-changed";
const ownerAuth={
 async getSession(){
  try{
   const r=await fetch("/api/access",{credentials:"same-origin",cache:"no-store"});
   const d=await r.json();return {data:{session:r.ok&&d.authenticated?{user:d.user}:null},error:null};
  }catch(e){return {data:{session:null},error:e};}
 },
 onAuthStateChange(listener:(event:string,session:any)=>void){
  const callback=async()=>{const {data}=await ownerAuth.getSession();listener(data.session?"SIGNED_IN":"SIGNED_OUT",data.session)};
  window.addEventListener(CURRENT_OWNER_EVENT,callback);
  return {data:{subscription:{unsubscribe:()=>window.removeEventListener(CURRENT_OWNER_EVENT,callback)}}};
 },
 async signOut(){
  const response=await fetch("/api/access",{method:"DELETE",credentials:"same-origin"});
  window.dispatchEvent(new Event(CURRENT_OWNER_EVENT));
  return {error:response.ok?null:new Error("Falha ao sair")};
 }
};
async function invoke(name:string,options:InvokeOptions={}){
 try{
  const route=["confrontos","ausencias","oportunidades","mercado-inteligente","simulador","resumo-rodada","news-brasileirao"].includes(name)?"analytics":"cartola";
  const response=await fetch("/api/"+route+"?name="+encodeURIComponent(name),{
   method:"POST",credentials:"same-origin",
   headers:{"Content-Type":"application/json",...options.headers},
   body:JSON.stringify(options.body||{})
  });
  const data=await response.json();
  if(!response.ok)return {data:null,error:new Error(data.error||"Falha da API "+response.status)};
  return {data,error:null};
 }catch(e){return {data:null,error:e instanceof Error?e:new Error("Falha de rede")};}
}
// Proxy avoids mutating the SDK's built-in auth implementation.
export const supabase:any=new Proxy(neon,{
 get(target,property){
  if(property==="auth")return ownerAuth;
  if(property==="functions")return {invoke};
  const value=Reflect.get(target,property,target);
  return typeof value==="function"?value.bind(target):value;
 }
});

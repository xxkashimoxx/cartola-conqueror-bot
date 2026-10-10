// Compatibility adapter. All private queries execute server-side against Neon PostgreSQL.
// No database password, user JWT, or Supabase credential ever enters the browser.
type InvokeOptions={body?:unknown;headers?:Record<string,string>};
const AUTH_EVENT="cartola-auth-changed";
const ownerAuth={
 async getSession(){
  try{const r=await fetch("/api/access",{credentials:"same-origin",cache:"no-store"});const d=await r.json();
   return {data:{session:r.ok&&d.authenticated?{user:d.user}:null},error:null};
  }catch(e){return {data:{session:null},error:e};}
 },
 onAuthStateChange(listener:(event:string,session:any)=>void){
  const callback=async()=>{const {data}=await ownerAuth.getSession();listener(data.session?"SIGNED_IN":"SIGNED_OUT",data.session)};
  window.addEventListener(AUTH_EVENT,callback);
  return {data:{subscription:{unsubscribe:()=>window.removeEventListener(AUTH_EVENT,callback)}}};
 },
 async signOut(){
  const response=await fetch("/api/access",{method:"DELETE",credentials:"same-origin"});
  window.dispatchEvent(new Event(AUTH_EVENT));
  return {error:response.ok?null:new Error("Falha ao sair")};
 }
};
async function invoke(name:string,options:InvokeOptions={}){
 try{
  const route=["confrontos","ausencias","oportunidades","mercado-inteligente","simulador","resumo-rodada","news-brasileirao"].includes(name)?"analytics":"cartola";
  const response=await fetch("/api/"+route+"?name="+encodeURIComponent(name),{
   method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",...options.headers},
   body:JSON.stringify(options.body||{})
  });
  const data=await response.json();
  if(!response.ok)return {data:null,error:new Error(data.error||"Falha da API "+response.status)};
  return {data,error:null};
 }catch(e){return {data:null,error:e instanceof Error?e:new Error("Falha de rede")};}
}
type Filter={column:string;op:string;value:unknown};
class DataQuery implements PromiseLike<any>{
 private columns="*";
 private filters:Filter[]=[];
 private ordering:{column:string;ascending:boolean}[]=[];
 private count=false;
 private head=false;
 private action="select";
 private payload:any=null;
 private maxRows=1000;
 private one=false;
 private optional=false;
 constructor(private readonly table:string){}
 select(columns="*",options:{count?:string;head?:boolean}={}){
  this.columns=columns;this.count=!!options.count;this.head=!!options.head;return this;
 }
 eq(column:string,value:unknown){this.filters.push({column,op:"eq",value});return this;}
 neq(column:string,value:unknown){this.filters.push({column,op:"neq",value});return this;}
 gt(column:string,value:unknown){this.filters.push({column,op:"gt",value});return this;}
 gte(column:string,value:unknown){this.filters.push({column,op:"gte",value});return this;}
 lt(column:string,value:unknown){this.filters.push({column,op:"lt",value});return this;}
 lte(column:string,value:unknown){this.filters.push({column,op:"lte",value});return this;}
 is(column:string,value:unknown){this.filters.push({column,op:"is",value});return this;}
 in(column:string,values:unknown[]){this.filters.push({column,op:"in",value:values});return this;}
 order(column:string,options:{ascending?:boolean}={}){this.ordering.push({column,ascending:options.ascending!==false});return this;}
 limit(n:number){this.maxRows=n;return this;}
 maybeSingle(){this.one=false;this.optional=true;return this;}
 single(){this.one=true;this.optional=false;return this;}
 insert(value:any){this.action="insert";this.payload=value;return this;}
 update(value:any){this.action="update";this.payload=value;return this;}
 upsert(value:any){this.action="upsert";this.payload=value;return this;}
 delete(){this.action="delete";return this;}
 private async run(){
  try{
   const res=await fetch("/api/data",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({table:this.table,action:this.action,data:this.payload,columns:this.columns,
      filters:this.filters,order:this.ordering,head:this.head,count:this.count,limit:this.maxRows,
      single:this.one,maybeSingle:this.optional})});
   const result=await res.json();
   return {data:result.data??null,count:result.count??null,error:result.error??(res.ok?null:{message:"Erro HTTP "+res.status})};
  }catch(e){return {data:null,count:null,error:{message:e instanceof Error?e.message:"Falha de rede"}};}
 }
 then<TResult1=any,TResult2=never>(onFulfilled?:((value:any)=>TResult1|PromiseLike<TResult1>)|null,onRejected?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null):Promise<TResult1|TResult2>{
  return this.run().then(onFulfilled,onRejected);
 }
}
export const supabase:any={
 auth:ownerAuth,
 functions:{invoke},
 from:(table:string)=>new DataQuery(table)
};

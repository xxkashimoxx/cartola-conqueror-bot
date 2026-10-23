import {neon} from "@neondatabase/serverless";
import {hasOwnerSession,ownerOnly,publicAppAccess,safeOrigin} from "../server/owner.js";
const TABLES=new Set(["atletas","clubes","posicoes","mercado_status","atleta_parciais","atleta_pontuacoes",
 "partidas","ausencias","oportunidades","news_cache","predictions_cache","profiles","user_roles","sync_analytics"]);
const WRITE_TABLES=new Set(["sync_analytics"]);
const PUBLIC_TABLES=new Set(["atletas","clubes","posicoes","mercado_status","atleta_parciais","atleta_pontuacoes","partidas","ausencias","oportunidades"]);
const ident=(name:any)=>typeof name==="string"&&/^[a-z][a-z0-9_]*$/.test(name)&&name.length<=70;
const sql=neon(process.env.DATABASE_URL||"");
const NUMERIC_COLUMNS=new Set(["preco","media","jogos","pontos_num","variacao_preco","pontos","score","valor_total","pontos_esperados","probabilidade","xg_casa","xg_fora","clean_sheet_casa","clean_sheet_fora","peso","rodada_atual","status_mercado"]);
function normalized(row:any){
  if(!row||typeof row!=="object")return row;
  return Object.fromEntries(Object.entries(row).map(([k,v])=>[k,NUMERIC_COLUMNS.has(k)&&typeof v==="string"&&v.trim()!==""&&Number.isFinite(Number(v))?Number(v):v]));
}

export default async function handler(req:any,res:any){
 if(req.method!=="POST")return res.status(405).json({data:null,error:{message:"Método inválido"}});
 if(!safeOrigin(req))return res.status(403).json({data:null,error:{message:"Origem não autorizada"}});
 res.setHeader("Cache-Control","no-store,private");
 const body=req.body||{},table=body.table,action=body.action||"select";
 if(!TABLES.has(table))return res.status(400).json({data:null,error:{message:"Tabela não permitida"}});
 if(!hasOwnerSession(req)&&!(publicAppAccess()&&action==="select"&&PUBLIC_TABLES.has(table))){ownerOnly(req,res);return;}
 try {
  if(action==="insert"){
   if(!WRITE_TABLES.has(table))return res.status(403).json({data:null,error:{message:"Escrita bloqueada nesta coleção"}});
   const record=body.data;
   if(!record||Array.isArray(record)||typeof record!=="object")throw Error("Registro inválido");
   const columns=Object.keys(record);
   if(!columns.length||columns.length>12||!columns.every(ident))throw Error("Colunas inválidas");
   const fields=columns.map(c=>'"'+c+'"').join(",");
   const placeholders=columns.map((_c,i)=>"$"+(i+1)).join(",");
   const query="insert into public."+table+"("+fields+") values("+placeholders+") returning *";
   const result=await sql.query(query,columns.map(c=>record[c]));
   return res.status(200).json({data:result,error:null});
  }
  if(action!=="select")return res.status(400).json({data:null,error:{message:"Operação indisponível"}});
  let columns=body.columns||"*";
  if(typeof columns!=="string"||columns.length>512)throw Error("Projeção inválida");
  const selected=columns==="*"?"*":columns.split(",").map((s:string)=>s.trim());
  if(selected!=="*"&&(!selected.length||!selected.every(ident)))throw Error("Use apenas colunas simples");
  const projection=selected==="*"?"*":selected.map((c:string)=>'"'+c+'"').join(",");
  const filters=Array.isArray(body.filters)?body.filters:[];
  if(filters.length>12)throw Error("Filtros demais");
  const args:any[]=[],conditions:string[]=[];
  for(const filter of filters){
   const c=filter.column,op=filter.op;
   if(!ident(c)||!["eq","neq","gt","gte","lt","lte","in","is"].includes(op))throw Error("Filtro inválido");
   if(op==="in"){
    const array=filter.value;
    if(!Array.isArray(array)||array.length>250)throw Error("Lista inválida");
    if(!array.length){conditions.push("false");continue;}
    const refs=array.map((item:any)=>{args.push(item);return "$"+args.length});
    conditions.push('"'+c+'" in ('+refs.join(",")+")");
   }else if(filter.value===null){
    conditions.push('"'+c+'" '+(op==="neq"?"is not null":"is null"));
   }else{
    args.push(filter.value);
    const ops:{[k:string]:string}={eq:"=",neq:"<>",gt:">",gte:">=",lt:"<",lte:"<=",is:"="};
    conditions.push('"'+c+'" '+ops[op]+" $"+args.length);
   }
  }
  const where=conditions.length?" where "+conditions.join(" and "):"";
  const order=Array.isArray(body.order)?body.order:[];
  if(order.length>3||order.some((o:any)=>!ident(o.column)))throw Error("Ordem inválida");
  const orderSql=order.length?" order by "+order.map((o:any)=>'"'+o.column+'" '+(o.ascending?"asc":"desc")).join(","):"";
  const countNeeded=!!body.count||!!body.head;
  const count=countNeeded?Number((await sql.query("select count(*)::int n from public."+table+where,args))[0]?.n||0):null;
  if(body.head)return res.status(200).json({data:null,count,error:null});
  const limit=Math.max(1,Math.min(15000,Number(body.limit)||1000));
  const result=await sql.query("select "+projection+" from public."+table+where+orderSql+" limit "+limit,args);
  if(body.single&&result.length!==1)return res.status(200).json({data:null,count,error:{message:"Resultado único não encontrado"}});
  return res.status(200).json({data:body.single||body.maybeSingle?normalized(result[0]||null):result.map(normalized),count,error:null});
 }catch(e){console.error("API de dados:",e instanceof Error?e.message:"erro");
  return res.status(400).json({data:null,error:{message:e instanceof Error?e.message:"Falha na consulta"}});}
}

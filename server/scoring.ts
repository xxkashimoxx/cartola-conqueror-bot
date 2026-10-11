import {neon} from "@neondatabase/serverless";

const db=neon(process.env.DATABASE_URL||"");
export type ScoreContext={rodada:number;currentRound:number|null;source:string;status:string;updatedAt:string;points:Map<number,{points:number;played:boolean|null}>;};
export type TeamScore={rodada:number;total:number|null;base:number|null;captainBonus:number|null;captainId:number|null;coverage:number;complete:boolean;source:string;status:string;updatedAt:string;players:{id:number;points:number;counted:number;played:boolean|null;reported:boolean;captain:boolean}[];notes:string[]};
const money=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
function parsePoints(data:any) {
 const pts=new Map<number,{points:number;played:boolean|null}>();
 const entries=Object.entries(data?.atletas||{});
 for(const [id,raw] of entries){
  const a:any=raw;const n=Number(id);
  if(Number.isSafeInteger(n)&&a&&Number.isFinite(Number(a.pontuacao))){
   pts.set(n,{points:Number(a.pontuacao),played:a.entrou_em_campo==null?null:!!a.entrou_em_campo});
  }
 }
 return pts;
}
async function official(path:string) {
 const r=await fetch("https://api.cartolafc.globo.com/"+path,{signal:AbortSignal.timeout(11000),headers:{"Accept":"application/json"}});
 if(!r.ok)throw Error("Globo status "+r.status);
 return r.json();
}
export async function scoringContext(rodada:number):Promise<ScoreContext>{
 let actualRound:number|null=null,bolaRolando=false,marketOpen=false;
 try{
  const status:any=await official("mercado/status");
  actualRound=Number(status.rodada_atual)||null;bolaRolando=!!status.bola_rolando;marketOpen=status.status_mercado===1;
 }catch{
  const rows=await db.query("select rodada_atual from public.mercado_status order by created_at desc,id desc limit 1",[]);
  actualRound=rows.length?Number(rows[0].rodada_atual):null;
 }
 const now=new Date().toISOString();
 if(actualRound!==null&&rodada>actualRound)return {rodada,currentRound:actualRound,source:"oficial",status:"ainda_nao_iniciada",updatedAt:now,points:new Map()};
 if(rodada===actualRound){
  if(marketOpen&&!bolaRolando)return {rodada,currentRound:actualRound,source:"Cartola FC — mercado aberto",status:"aguardando_rodada",updatedAt:now,points:new Map()};
  try{
   const live=await official("atletas/pontuados");
   const points=parsePoints(live);
   if(points.size)return {rodada,currentRound:actualRound,source:"Cartola FC — API oficial",status:bolaRolando?"parcial":"parcial_ou_revisao",updatedAt:now,points};
  }catch(e){console.warn("Parciais oficiais indisponíveis",e);}
  const rows=await db.query("select atleta_id,pontos,jogou,atualizado_em from public.atleta_parciais where rodada=$1",[rodada]);
  const points=new Map<number,{points:number;played:boolean|null}>();
  for(const r of rows)points.set(Number(r.atleta_id),{points:Number(r.pontos),played:r.jogou});
  return {rodada,currentRound:actualRound,source:"Neon — último espelho do Cartola",status:points.size?"parcial_cache":"sem_parciais",updatedAt:rows.reduce((max:string,r:any)=>String(r.atualizado_em)>max?String(r.atualizado_em):max,""),points};
 }
 // Round finished: archived scores from Cartola are authoritative for that round.
 const rows=await db.query("select atleta_id,pontos from public.atleta_pontuacoes where rodada=$1",[rodada]);
 const points=new Map<number,{points:number;played:boolean|null}>();
 for(const r of rows)points.set(Number(r.atleta_id),{points:Number(r.pontos),played:null});
 if(points.size)return {rodada,currentRound:actualRound,source:"Cartola FC — histórico oficial salvo no Neon",status:"encerrada",updatedAt:now,points};
 try{
  const response=await official("atletas/pontuados/"+rodada);
  return {rodada,currentRound:actualRound,source:"Cartola FC — API histórica",status:"encerrada",updatedAt:now,points:parsePoints(response)};
 }catch{
  return {rodada,currentRound:actualRound,source:"indisponível",status:"sem_dados",updatedAt:now,points:new Map()};
 }
}
export function scoreTeam(rodada:number,ids:number[],captainId:number|null,context:ScoreContext):TeamScore{
 const unique=[...new Set(ids)];
 const valid=unique.length===12&&ids.length===12&&ids.every(x=>Number.isSafeInteger(x)&&x>0);
 const validCaptain=captainId!==null&&unique.includes(captainId);
 const coverage=unique.filter(id=>context.points.has(id)).length;
 const notes:string[]=[];
 if(!valid)notes.push("Escalação incompleta ou com atletas repetidos.");
 if(!validCaptain)notes.push("Capitão não registrado: bônus de 50% ainda não calculado.");
 if(context.currentRound===rodada)notes.push("Pontuação parcial: o Cartola pode revisar scouts e pontuações até o encerramento.");
 notes.push("Cálculo hipotético do time titular; não considera substituições automáticas do banco de reservas.");
 const players=unique.map(id=>{
  const row=context.points.get(id),isCaptain=validCaptain&&id===captainId;
  const raw=row?.points??0;
  return {id,points:money(raw),counted:money(raw*(isCaptain?1.5:1)),played:row?.played??null,reported:!!row,captain:isCaptain};
 });
 const known=context.points.size>0&&valid;
 const base=players.reduce((s,p)=>s+p.points,0);
 const bonus=validCaptain?(context.points.get(captainId!)?.points??0)*.5:0;
 const total=base+(validCaptain?bonus:0);
 return {
  rodada,total:known?money(total):null,base:known?money(base):null,
  captainBonus:known&&validCaptain?money(bonus):null,captainId:validCaptain?captainId:null,
  coverage,complete:context.status==="encerrada"&&known,
  source:context.source,status:context.status,updatedAt:context.updatedAt,players,notes
 };
}

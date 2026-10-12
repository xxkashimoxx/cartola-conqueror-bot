import {neon} from "@neondatabase/serverless";
import {type Fixture} from "./bench.js";

const db=neon(process.env.DATABASE_URL||"");
export type ScoreContext={rodada:number;currentRound:number|null;source:string;status:string;updatedAt:string;points:Map<number,{points:number;played:boolean|null}>;fixtures:Map<number,Fixture>};
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
function kickoff(value:unknown):number|null {
 const raw=String(value||"");
 if(!raw)return null;
 const time=Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)?raw.replace(" ","T")+"-03:00":raw);
 return Number.isFinite(time)?time:null;
}
function finished(status:unknown):boolean {
 return /ENCERR|FINALIZ|TERMIN|CONCLU|^FIM$/i.test(String(status||""));
}
function fixtureMap(matches:any[]):Map<number,Fixture> {
 const fixtures=new Map<number,Fixture>();
 for(const match of matches) {
  if(match.valida===false)continue;
  const fixture={kickoff:kickoff(match.partida_data||match.data_partida),finished:finished(match.status_transmissao_tr||match.status_jogo)};
  for(const id of [match.clube_casa_id??match.time_casa_id,match.clube_visitante_id??match.time_fora_id]) {
   if(Number.isSafeInteger(Number(id))&&Number(id)>0)fixtures.set(Number(id),fixture);
  }
 }
 return fixtures;
}
async function fixturesForRound(rodada:number,live:boolean):Promise<Map<number,Fixture>> {
 if(live) {
  try{
   const matches:any=await official("partidas/"+rodada);
   const fixtures=fixtureMap(matches.partidas||[]);
   if(fixtures.size)return fixtures;
  }catch(e){console.warn("Partidas oficiais indisponíveis",e);}
 }
 const rows=await db.query("select time_casa_id,time_fora_id,data_partida,status_jogo from public.partidas where rodada=$1",[rodada]);
 return fixtureMap(rows);
}
export async function scoringContext(rodada:number,includeParticipation=false):Promise<ScoreContext>{
 let actualRound:number|null=null,bolaRolando=false,marketOpen=false;
 try{
  const status:any=await official("mercado/status");
  actualRound=Number(status.rodada_atual)||null;bolaRolando=!!status.bola_rolando;marketOpen=status.status_mercado===1;
 }catch{
  const rows=await db.query("select rodada_atual from public.mercado_status order by created_at desc,id desc limit 1",[]);
  actualRound=rows.length?Number(rows[0].rodada_atual):null;
 }
 const now=new Date().toISOString();
  if(actualRound!==null&&rodada>actualRound)return {rodada,currentRound:actualRound,source:"oficial",status:"ainda_nao_iniciada",updatedAt:now,points:new Map(),fixtures:new Map()};
 if(rodada===actualRound){
   if(marketOpen&&!bolaRolando)return {rodada,currentRound:actualRound,source:"Cartola FC — mercado aberto",status:"aguardando_rodada",updatedAt:now,points:new Map(),fixtures:new Map()};
   const fixtures=await fixturesForRound(rodada,true);
  try{
   const live=await official("atletas/pontuados");
   const points=parsePoints(live);
    if(points.size)return {rodada,currentRound:actualRound,source:"Cartola FC — API oficial",status:bolaRolando?"parcial":"parcial_ou_revisao",updatedAt:now,points,fixtures};
  }catch(e){console.warn("Parciais oficiais indisponíveis",e);}
  const rows=await db.query("select atleta_id,pontos,jogou,atualizado_em from public.atleta_parciais where rodada=$1",[rodada]);
  const points=new Map<number,{points:number;played:boolean|null}>();
  for(const r of rows)points.set(Number(r.atleta_id),{points:Number(r.pontos),played:r.jogou});
   return {rodada,currentRound:actualRound,source:"Neon — último espelho do Cartola",status:points.size?"parcial_cache":"sem_parciais",updatedAt:rows.reduce((max:string,r:any)=>String(r.atualizado_em)>max?String(r.atualizado_em):max,""),points,fixtures};
 }
  const fixtures=await fixturesForRound(rodada,false);
  // Historic API includes participation. The Neon archive is the fallback when it is unavailable.
  if(includeParticipation){
   try{
    const historic=await official("atletas/pontuados/"+rodada);
    const points=parsePoints(historic);
    if(points.size)return {rodada,currentRound:actualRound,source:"Cartola FC — API histórica",status:"encerrada",updatedAt:now,points,fixtures};
   }catch(e){console.warn("Participação histórica indisponível",rodada,e);}
  }
  const rows=await db.query("select atleta_id,pontos,jogou from public.atleta_pontuacoes where rodada=$1",[rodada]);
 const points=new Map<number,{points:number;played:boolean|null}>();
  for(const r of rows)points.set(Number(r.atleta_id),{points:Number(r.pontos),played:r.jogou});
  if(points.size)return {rodada,currentRound:actualRound,source:"Cartola FC — histórico oficial salvo no Neon",status:"encerrada",updatedAt:now,points,fixtures};
 try{
  const response=await official("atletas/pontuados/"+rodada);
   return {rodada,currentRound:actualRound,source:"Cartola FC — API histórica",status:"encerrada",updatedAt:now,points:parsePoints(response),fixtures};
 }catch{
   return {rodada,currentRound:actualRound,source:"indisponível",status:"sem_dados",updatedAt:now,points:new Map(),fixtures};
 }
}
export {scoreTeam} from "./scoreTeam.js";
export type {TeamScore} from "./scoreTeam.js";

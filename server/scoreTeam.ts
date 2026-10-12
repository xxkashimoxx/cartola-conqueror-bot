import {resolveBench, type AthleteInfo} from "./bench.js";
import type {ScoreContext} from "./scoring.js";

export type TeamScore={rodada:number;total:number|null;base:number|null;captainBonus:number|null;captainId:number|null;coverage:number;complete:boolean;source:string;status:string;updatedAt:string;players:{id:number;originalId:number;points:number;counted:number;played:boolean|null;reported:boolean;captain:boolean;fromBench:boolean}[];bench:{id:number;points:number;played:boolean|null;reported:boolean;entered:boolean}[];substitutions:{outId:number;inId:number;position:number;captain:boolean}[];notes:string[]};
const money=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;

export function scoreTeam(rodada:number,ids:number[],captainId:number|null,context:ScoreContext,benchIds:number[]=[],athletes=new Map<number,AthleteInfo>()):TeamScore{
 const unique=[...new Set(ids)];
 const valid=unique.length===12&&ids.length===12&&ids.every(x=>Number.isSafeInteger(x)&&x>0);
 const validCaptain=captainId!==null&&unique.includes(captainId);
  const confirmedFixtures=context.status==="parcial_cache"?new Map():context.fixtures;
  const substitutions=resolveBench(ids,captainId,benchIds,context.points,athletes,confirmedFixtures,context.status==="encerrada");
  const swaps=new Map(substitutions.map(s=>[s.outId,s.inId]));
  const captainReplacement=substitutions.find(s=>s.outId===captainId);
  const captainInfo=athletes.get(captainId??0),captainFixture=confirmedFixtures.get(captainInfo?.clube_id??0);
  const captainPoints=context.points.get(captainId??0);
  const captainAbsent=!!captainInfo&&(captainFixture?.finished||context.status==="encerrada")&&(!captainPoints||captainPoints.played===false);
  const effectiveCaptain=validCaptain?(captainReplacement?.inId??(captainAbsent?null:captainId)):null;
 const notes:string[]=[];
 if(!valid)notes.push("Escalação incompleta ou com atletas repetidos.");
 if(!validCaptain)notes.push("Capitão não registrado: bônus de 50% ainda não calculado.");
 if(context.currentRound===rodada)notes.push("Pontuação parcial: o Cartola pode revisar scouts e pontuações até o encerramento.");
  if(!benchIds.length)notes.push("Banco ainda não escalado nesta rodada.");
  if(context.status==="parcial_cache"&&benchIds.length)notes.push("Dados do cache: trocas aguardam confirmação da API oficial.");
  if(substitutions.length)notes.push(substitutions.length+" substituição(ões) automática(s) por ausência confirmada.");
  if(captainAbsent&&!captainReplacement)notes.push("Capitão não jogou e não foi substituído: sem bônus de capitão.");
  const players=unique.map(originalId=>{
   const id=swaps.get(originalId)??originalId;
   const row=context.points.get(id),isCaptain=id===effectiveCaptain;
  const raw=row?.points??0;
   return {id,originalId,points:money(raw),counted:money(raw*(isCaptain?1.5:1)),played:row?.played??null,reported:!!row,captain:isCaptain,fromBench:id!==originalId};
 });
  const bench=benchIds.map(id=>({id,points:money(context.points.get(id)?.points??0),played:context.points.get(id)?.played??null,reported:context.points.has(id),entered:substitutions.some(s=>s.inId===id)}));
  const coverage=players.filter(p=>p.reported).length;
 const known=context.points.size>0&&valid;
 const base=players.reduce((s,p)=>s+p.points,0);
  const bonus=effectiveCaptain!==null?(context.points.get(effectiveCaptain)?.points??0)*.5:0;
  const total=base+bonus;
 return {
  rodada,total:known?money(total):null,base:known?money(base):null,
   captainBonus:known&&validCaptain?money(bonus):null,captainId:effectiveCaptain,
  coverage,complete:context.status==="encerrada"&&known,
   source:context.source,status:context.status,updatedAt:context.updatedAt,players,bench,substitutions,notes
 };
}

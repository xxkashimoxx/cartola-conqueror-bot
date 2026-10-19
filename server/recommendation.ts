// Pure lineup search shared with tests. No database access here.
export type Candidate={id:number;apelido:string;nome:string;clube_id:number;posicao_id:number;preco:number;media:number;jogos:number;status_id:number;variacao_preco:number;foto_url:string|null;predictedScore:number;volatility:number;objective:number;opponent:string|null;home:boolean|null;sample:number;reason:string;confidence:string};
const FORMATION=[1,2,2,3,3,4,4,4,5,5,5,6];
const round=(n:number)=>Math.round(n*100)/100;
function grouped<T extends {posicao_id:number}>(records:T[]):Record<number,T[]>{
 const d:Record<number,T[]>={};for(const r of records)(d[r.posicao_id]||=[]).push(r);return d;
}
type Node={lineup:Candidate[];total:number;objective:number;teams:Record<number,number>;last:number;captainValue:number};
const rosterValue=(node:Node)=>node.objective+node.captainValue*.5;
export function optimize(candidates:Candidate[],budget:number){
 const groups=grouped(candidates);
 const pools:Record<number,Candidate[]>={};
 for(const position of [1,2,3,4,5,6]){
  const all=(groups[position]||[]).filter(x=>x.preco>0&&x.status_id===7);
  const top=[...all].sort((a,b)=>b.objective-a.objective).slice(0,25);
  const efficient=[...all].sort((a,b)=>b.objective/Math.sqrt(b.preco)-a.objective/Math.sqrt(a.preco)).slice(0,12);
  const cheapest=[...all].sort((a,b)=>a.preco-b.preco).slice(0,10);
  const merged=new Map([...top,...efficient,...cheapest].map(x=>[x.id,x]));
  pools[position]=[...merged.values()].sort((a,b)=>b.objective-a.objective);
  if(pools[position].length<FORMATION.filter(p=>p===position).length)throw Error("Atletas prováveis insuficientes na posição "+position);
 }
 const minimumFrom=(offset:number)=>{
  const rem=FORMATION.slice(offset);let value=0;
  for(const pos of new Set(rem)){
   const count=rem.filter(p=>p===pos).length;
   value+=[...pools[pos]].sort((a,b)=>a.preco-b.preco).slice(0,count).reduce((s,c)=>s+c.preco,0);
  }return value;
 };
 const lower=FORMATION.map((_p,i)=>minimumFrom(i+1));
 let beam:Node[]=[{lineup:[],total:0,objective:0,teams:{},last:-1,captainValue:0}];
 for(let step=0;step<FORMATION.length;step++){
  const pos=FORMATION[step],same=step>0&&FORMATION[step-1]===pos;
  const next:Node[]=[];
  const pool=pools[pos];
  for(const state of beam){
   for(let i=same?state.last+1:0;i<pool.length;i++){
    const c=pool[i],price=state.total+c.preco;
    if(price+lower[step]>budget+.0001)continue;
    const count=state.teams[c.clube_id]||0;
    // A cap of four per club excluded viable stacks: the round 31 leader used five.
    // Keep a small diversification cost without forbidding a strong matchup.
    const penalty=count>0 ? count*.06 : 0;
    next.push({lineup:[...state.lineup,c],total:price,objective:state.objective+c.objective-penalty,
     teams:{...state.teams,[c.clube_id]:count+1},last:i,
     captainValue:c.posicao_id===6?state.captainValue:Math.max(state.captainValue,c.objective)});
   }
  }
  if(!next.length)throw Error("Patrimônio insuficiente para um time com 12 prováveis. Aumente o orçamento.");
  // Retain competitive lineups across different budget buckets, not only expensive ones.
  next.sort((a,b)=>rosterValue(b)-rosterValue(a));
  const byPrice=new Map<number,number>(),kept:Node[]=[];
  for(const node of next){
   const bucket=Math.floor(node.total/5),n=byPrice.get(bucket)||0;
   if(n>=45)continue;
   byPrice.set(bucket,n+1);kept.push(node);
   if(kept.length>=750)break;
  }
  beam=kept;
 }
 const valid=beam.filter(n=>Object.keys(n.teams).length>=3&&n.lineup.length===12&&n.total<=budget);
 if(!valid.length)throw Error("Nenhuma escalação válida sob as restrições de orçamento e diversificação.");
 valid.sort((a,b)=>rosterValue(b)-rosterValue(a));
 const best=valid[0];
 const captain=[...best.lineup].filter(c=>c.posicao_id!==6)
  .sort((a,b)=>b.objective-a.objective)[0];
  const starterIds=new Set(best.lineup.map(a=>a.id));
  const reserves=[1,2,3,4,5].map(position=>{
   const cheapest=Math.min(...best.lineup.filter(a=>a.posicao_id===position).map(a=>a.preco));
   return candidates.filter(a=>a.posicao_id===position&&!starterIds.has(a.id)&&a.status_id===7&&
     Math.round(a.preco*100)<=Math.round(cheapest*100))
     .sort((a,b)=>b.objective-a.objective)[0]||null;
  });
 return {players:best.lineup,capital:round(best.total),remaining:round(budget-best.total),
  projectedPoints:round(best.lineup.reduce((s,c)=>s+c.predictedScore,0)+Math.max(0,captain?.predictedScore||0)*.5),
   objective:round(rosterValue(best)),captainId:captain?.id,reserves,formation:"4-3-3",cardsReviewed:candidates.length,teamsUsed:Object.keys(best.teams).length};
}

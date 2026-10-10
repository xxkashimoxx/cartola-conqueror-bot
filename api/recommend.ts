import {neon} from "@neondatabase/serverless";
import {ownerOnly} from "../server/owner.js";
type Mode="balanceada"|"ofensiva"|"defensiva";
type Candidate={id:number;apelido:string;nome:string;clube_id:number;posicao_id:number;preco:number;media:number;jogos:number;status_id:number;variacao_preco:number;foto_url:string|null;predictedScore:number;volatility:number;objective:number;opponent:string|null;home:boolean|null;sample:number;reason:string;confidence:string};
const FORMATION=[1,2,2,3,3,4,4,4,5,5,5,6]; // Cartola clássico 4-3-3, 11 atletas + técnico
const sql=neon(process.env.DATABASE_URL||"");
const num=(v:any)=>Number(v)||0;
const clamp=(n:number,low:number,high:number)=>Math.max(low,Math.min(high,n));
const round=(n:number)=>Math.round(n*100)/100;
function grouped<T extends {posicao_id:number}>(records:T[]):Record<number,T[]>{
 const d:Record<number,T[]>={};for(const r of records)(d[r.posicao_id]||=[]).push(r);return d;
}
async function officialFixtures(rodada:number){
 const response=await fetch("https://api.cartolafc.globo.com/partidas/"+rodada,{signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error("Jogos indisponíveis");
 const json:any=await response.json();
 const names=json.clubes||{};
 const out=new Map<number,{opponent:string;home:boolean;ownRank:number|null;opponentRank:number|null}>();
 for(const match of json.partidas||[]){
  if(match.valida===false)continue;
  const home=num(match.clube_casa_id),away=num(match.clube_visitante_id);
  if(!home||!away)continue;
  const homeName=names[String(home)]?.abreviacao||names[String(home)]?.nome||String(home);
  const awayName=names[String(away)]?.abreviacao||names[String(away)]?.nome||String(away);
  out.set(home,{opponent:awayName,home:true,ownRank:match.clube_casa_posicao??null,opponentRank:match.clube_visitante_posicao??null});
  out.set(away,{opponent:homeName,home:false,ownRank:match.clube_visitante_posicao??null,opponentRank:match.clube_casa_posicao??null});
 }
 return out;
}
function compute(raw:any,points:number[],context:{opponent:string;home:boolean;ownRank:number|null;opponentRank:number|null}|undefined,mode:Mode):Candidate{
 const games=num(raw.jogos),average=num(raw.media),price=num(raw.preco);
 const recent=points.slice(0,10),sample=recent.length;
 const weights=recent.map((_v,i)=>Math.pow(.80,i));
 const weighted=sample?recent.reduce((t,n,i)=>t+n*weights[i],0)/weights.reduce((t,n)=>t+n,0):average;
 const shrink=clamp(sample/9,.15,.58);
 const blended=average*(1-shrink)+weighted*shrink;
 const mean=sample?recent.reduce((t,n)=>t+n,0)/sample:average;
 const deviation=sample>=3?Math.sqrt(recent.reduce((t,n)=>t+Math.pow(n-mean,2),0)/sample):Math.max(1.4,average*.55);
 const volatility=deviation/Math.max(2,Math.abs(blended));
 const reliability=clamp((games-2)/14,0,1);
 const ranks=context?.ownRank&&context?.opponentRank ? clamp((context.opponentRank-context.ownRank)/19,-1,1):0;
 // modest adjustments only: avoid overfitting league rank and home/away advantages
 const matchFactor=clamp(1+(context?.home===true?.045:context?.home===false?-.035:0)+ranks*.095,.82,1.18);
 const predicted=clamp(blended*matchFactor,-1,22);
 const def=[1,2,3].includes(raw.posicao_id);
 const att=[4,5].includes(raw.posicao_id);
 const stability=clamp(1-volatility*.12,.72,1);
 const base=predicted;
 const objective=mode==="ofensiva" ? base+deviation*.29+(att?.14:0)+Math.max(0,base-5)*.045 :
   mode==="defensiva" ? base-deviation*.33+reliability*.5+(def?.12:0) :
   base*stability-deviation*.08+reliability*.19;
 return {id:raw.id,apelido:raw.apelido,nome:raw.nome,clube_id:raw.clube_id,posicao_id:raw.posicao_id,
  preco:price,media:average,jogos:games,status_id:raw.status_id,variacao_preco:num(raw.variacao_preco),
  foto_url:raw.foto_url,predictedScore:round(predicted),volatility:round(volatility),objective:round(objective),
  opponent:context?.opponent||null,home:context?.home??null,sample,
  reason:[sample?sample+" rodadas históricas recentes":"Média da temporada",
    context?.opponent? (context.home?"Mandante contra ":"Visitante contra ")+context.opponent :"Adversário não confirmado",
    games>=8?"Amostra regular":"Amostra menor"].join(" · "),
  confidence:games>=10&&sample>=5?"alta":games>=5&&sample>=3?"moderada":"baixa"};
}
type Node={lineup:Candidate[];total:number;objective:number;teams:Record<number,number>;last:number};
function optimize(candidates:Candidate[],budget:number){
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
 let beam:Node[]=[{lineup:[],total:0,objective:0,teams:{},last:-1}];
 for(let step=0;step<FORMATION.length;step++){
  const pos=FORMATION[step],same=step>0&&FORMATION[step-1]===pos;
  const next:Node[]=[];
  const pool=pools[pos];
  for(const state of beam){
   for(let i=same?state.last+1:0;i<pool.length;i++){
    const c=pool[i],price=state.total+c.preco;
    if(price+lower[step]>budget+.0001)continue;
    const count=state.teams[c.clube_id]||0;
    if(count>=4)continue; // risk-diversification preference, not a Cartola rule
    const penalty=count>0 ? count*.085 : 0;
    next.push({lineup:[...state.lineup,c],total:price,objective:state.objective+c.objective-penalty,
     teams:{...state.teams,[c.clube_id]:count+1},last:i});
   }
  }
  if(!next.length)throw Error("Patrimônio insuficiente para um time com 12 prováveis. Aumente o orçamento.");
  // Retain competitive lineups across different budget buckets, not only expensive ones.
  next.sort((a,b)=>b.objective-a.objective);
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
 valid.sort((a,b)=>b.objective-a.objective);
 const best=valid[0];
 const captain=[...best.lineup].filter(c=>c.posicao_id!==6)
  .sort((a,b)=>(b.predictedScore-(b.volatility*.24))-(a.predictedScore-a.volatility*.24))[0];
 return {players:best.lineup,capital:round(best.total),remaining:round(budget-best.total),
  projectedPoints:round(best.lineup.reduce((s,c)=>s+c.predictedScore,0)+Math.max(0,captain?.predictedScore||0)*.5),
  objective:round(best.objective),captainId:captain?.id,formation:"4-3-3",cardsReviewed:candidates.length,teamsUsed:Object.keys(best.teams).length};
}
export default async function handler(req:any,res:any){
 if(!ownerOnly(req,res))return;
 if(req.method!=="GET")return res.status(405).json({success:false,error:"GET obrigatório"});
 const m=String(req.query?.mode||"balanceada");
 if(!["balanceada","ofensiva","defensiva"].includes(m))return res.status(400).json({error:"Modo inválido"});
 const mode=m as Mode,budget=num(req.query?.budget);
 if(budget<35||budget>1000)return res.status(400).json({error:"Informe entre C$ 35 e C$ 1000."});
 try{
  const market=await sql.query("select rodada_atual,status_mercado,fechamento from public.mercado_status order by created_at desc,id desc limit 1",[]);
  if(!market.length)return res.status(503).json({error:"Cartola ainda não foi sincronizado no Neon."});
  const rodada=num(market[0].rodada_atual);
  const [records,historical,fixture]=await Promise.all([
   sql.query("select id,nome,apelido,clube_id,posicao_id,preco,media,jogos,status_id,variacao_preco,foto_url from public.atletas where status_id=7 and clube_id is not null and preco>0 and media is not null and jogos>=2",[]),
   sql.query("select atleta_id,rodada,pontos from public.atleta_pontuacoes where rodada between $1 and $2 order by rodada desc",[Math.max(1,rodada-12),rodada-1]),
   officialFixtures(rodada).catch(()=>new Map()),
  ]);
  const history=new Map<number,number[]>();
  for(const entry of historical){const id=num(entry.atleta_id);if(!history.has(id))history.set(id,[]);history.get(id)!.push(num(entry.pontos));}
  const list=records.map((a:any)=>compute(a,history.get(a.id)||[],fixture.get(a.clube_id),mode));
  const result=optimize(list,budget);
  res.setHeader("Cache-Control","no-store");
  return res.status(200).json({success:true,mode,rodada,budget,mercadoAberto:market[0].status_mercado===1,
   consultadoEm:new Date().toISOString(),metodologia:"Média da temporada + últimas 10 pontuações ponderadas + amostra + mando + posição do adversário + volatilidade. Otimização por busca em feixe, sob orçamento e 4-3-3. Estratégias com riscos distintos; sem garantia de pontuação.",...result});
 }catch(e){console.error("Otimização:",e);
  return res.status(422).json({success:false,error:e instanceof Error?e.message:"Não foi possível otimizar"});}
}
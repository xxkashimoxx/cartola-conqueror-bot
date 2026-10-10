import {ownerOnly} from "../server/owner.js";
// Live scoreboard from the Cartola official public API. Read-only and cached briefly.
export default async function handler(req:any,res:any){
  if(req.method!=="GET")return res.status(405).json({error:"GET obrigatório"});
  if(!ownerOnly(req,res))return;
  try{
    const [a,b]=await Promise.all([
      fetch("https://api.cartolafc.globo.com/mercado/status",{signal:AbortSignal.timeout(9000)}),
      fetch("https://api.cartolafc.globo.com/atletas/pontuados",{signal:AbortSignal.timeout(9000)})
    ]);
    if(!a.ok||!b.ok)throw new Error("API Cartola FC temporariamente indisponível");
    const [mercado,parciais]:any[]=await Promise.all([a.json(),b.json()]);
    const scores=Object.entries(parciais.atletas||{}).map(([id,p]:[string,any])=>({
      atleta_id:Number(id),pontos:Number(p.pontuacao)||0,scout:p.scout||{},
      jogou:p.entrou_em_campo===true,atualizado_em:new Date().toISOString()
    })).filter(p=>Number.isSafeInteger(p.atleta_id));
    res.setHeader("Cache-Control","public, s-maxage=20, stale-while-revalidate=30");
    return res.status(200).json({success:true,temporada:mercado.temporada,rodada:mercado.rodada_atual,
      bolaRolando:!!mercado.bola_rolando,status_mercado:mercado.status_mercado,
      atualizado_em:new Date().toISOString(),scores});
  }catch(e){console.error("Live Cartola",e);return res.status(503).json({success:false,error:"Parciais indisponíveis temporariamente"});}
}
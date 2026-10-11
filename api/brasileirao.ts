import {ownerOnly} from "../server/owner.js";
// Brasileirão Série A and Cartola FC 2026 live official round.
export default async function handler(req:any,res:any){
 if(req.method!=="GET")return res.status(405).json({error:"Método inválido"});
 if(!ownerOnly(req,res))return;
 try{
  const statusReq=await fetch("https://api.cartolafc.globo.com/mercado/status",{signal:AbortSignal.timeout(10000)});
  if(!statusReq.ok)throw new Error("Não foi possível consultar o mercado");
  const s:any=await statusReq.json();
  const round=Number(s.rodada_atual);
  if(!Number.isInteger(round)||round<1||round>38)throw new Error("Rodada inválida");
  const pReq=await fetch("https://api.cartolafc.globo.com/partidas/"+round,{signal:AbortSignal.timeout(10000)});
  if(!pReq.ok)throw new Error("Não foi possível consultar as partidas");
  const j:any=await pReq.json();
  const clubs=j.clubes||{};
  const times=(id:number)=>{const c=clubs[String(id)]||{};return {id,nome:c.apelido||c.nome||"Clube",sigla:c.abreviacao||c.nome||"",escudo:c.escudos?.["60x60"]||null}};
  const jogos=(j.partidas||[]).filter((p:any)=>p.valida!==false).map((p:any)=>({
    id:Number(p.partida_id),rodada:round,
    casa:times(Number(p.clube_casa_id)),fora:times(Number(p.clube_visitante_id)),
    posicaoCasa:p.clube_casa_posicao??null,posicaoFora:p.clube_visitante_posicao??null,
    placarCasa:typeof p.placar_oficial_mandante==="number"?p.placar_oficial_mandante:null,
    placarFora:typeof p.placar_oficial_visitante==="number"?p.placar_oficial_visitante:null,
    partidaEm:new Date(String(p.partida_data).replace(" ","T")+"-03:00").toISOString(),
    estadio:p.local||null,
    status:p.status_transmissao_tr||p.status_cronometro_tr||"AGENDADO",
    periodo:p.periodo_tr||null,
    fonte:p.transmissao?.url||null,
  })).sort((a:any,b:any)=>new Date(a.partidaEm).valueOf()-new Date(b.partidaEm).valueOf());
  res.setHeader("Cache-Control","private,no-store");
  return res.status(200).json({success:true,temporada:s.temporada||2026,rodada:round,rodadaFinal:s.rodada_final||38,
    retaFinal:round>=27,rodadasRestantes:Math.max(0,(s.rodada_final||38)-round+1),
    bolaRolando:!!s.bola_rolando,mercadoAberto:s.status_mercado===1,
    fechamento:s.fechamento,jogos,atualizadoEm:new Date().toISOString(),
    fonte:"API oficial Cartola FC / ge.globo.com"});
 }catch(e){console.error("Brasileirão oficial",e);return res.status(503).json({success:false,error:"Jogos oficiais indisponíveis no momento"});}
}
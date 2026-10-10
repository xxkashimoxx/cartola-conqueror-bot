import {useEffect,useState} from "react";
import {Badge} from "@/components/ui/badge";
import {Card,CardContent} from "@/components/ui/card";
type Status={temporada:number;rodada:number;rodadaFinal:number;mercado:number;bolaRolando:boolean;fechamento?:{timestamp:number};consultadoEm:string};
export default function SeasonStatusBanner(){
  const [s,setS]=useState<Status|null>(null);
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{
      try{
        const r=await fetch("/api/cartola?name=status-temporada");
        if(!r.ok)throw new Error("status");
        const data=await r.json();
        if(active&&data.success)setS(data);
      }catch(e){console.warn("Status do Cartola não disponível",e);}
    };
    void refresh();
    const timer=window.setInterval(refresh,120000);
    return()=>{active=false;clearInterval(timer);};
  },[]);
  if(!s)return null;
  const fechado=s.mercado!==1;
  return <Card className="border-primary/40 bg-card">
    <CardContent className="p-4 flex flex-wrap gap-3 items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Brasileirão Série A · Temporada {s.temporada}</p>
        <h2 className="text-xl font-black">Rodada {s.rodada} <span className="text-muted-foreground font-medium text-sm">de {s.rodadaFinal||38}</span></h2>
        <p className="text-xs text-muted-foreground">Dados ao vivo: API oficial Cartola FC</p>
      </div>
      <div className="flex flex-col gap-1 items-end">
        <Badge variant={fechado?"destructive":"default"}>{fechado?"Mercado fechado":"Mercado aberto"}</Badge>
        {s.bolaRolando&&<p className="text-xs font-semibold text-neon-green">Bola rolando · parciais disponíveis</p>}
        {s.fechamento?.timestamp&&<p className="text-xs text-muted-foreground">Fechamento: {new Date(s.fechamento.timestamp*1000).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</p>}
      </div>
    </CardContent>
  </Card>;
}
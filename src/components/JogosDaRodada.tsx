import {useEffect,useState} from "react";
import {Card,CardContent} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
type Clube={id:number;nome:string;sigla:string;escudo:string|null};
type Jogo={id:number;casa:Clube;fora:Clube;placarCasa:number|null;placarFora:number|null;partidaEm:string;status:string;periodo:string|null;fonte:string|null;posicaoCasa:number|null;posicaoFora:number|null};
type Rodada={rodada:number;rodadaFinal:number;rodadasRestantes:number;retaFinal:boolean;jogos:Jogo[];atualizadoEm:string};
export default function JogosDaRodada(){
 const [r,setR]=useState<Rodada|null>(null);
 useEffect(()=>{
  let alive=true;
  async function update(){
   try{const response=await fetch("/api/brasileirao");if(!response.ok)throw new Error("Jogos indisponíveis");
    const data=await response.json();if(data.success&&alive)setR(data)}
   catch(e){console.warn("Não foi possível atualizar partidas",e)}
  }
  void update();const timer=window.setInterval(update,60000);
  return()=>{alive=false;clearInterval(timer)}
 },[]);
 if(!r?.jogos?.length)return null;
 const renderClub=(c:Clube,pos:number|null)=>(
   <div className="flex gap-2 min-w-0 items-center">
    {c.escudo&&<img src={c.escudo} alt="" loading="lazy" className="h-7 w-7 object-contain shrink-0"/>}
    <span className="text-sm font-bold truncate">{c.sigla}</span>
    {pos&&<span className="text-[10px] text-muted-foreground">#{pos}</span>}
   </div>
 );
 return <section className="space-y-3">
  <div className="flex flex-wrap gap-2 justify-between items-end">
   <div><h2 className="font-black text-xl text-foreground">Jogos da rodada {r.rodada}</h2>
    <p className="text-xs text-muted-foreground">{r.retaFinal?"Reta final · ":""}{r.rodadasRestantes} rodadas incluindo a atual · Fonte Cartola FC</p>
   </div>
   <Badge variant="outline">Atualização automática a cada minuto</Badge>
  </div>
  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
   {r.jogos.map(j=><Card key={j.id} className="border-border/70 bg-card/70">
    <CardContent className="p-3">
      <div className="flex justify-between items-center gap-2">
       {renderClub(j.casa,j.posicaoCasa)}
       <div className="shrink-0 text-center">
         <div className="font-black text-lg tabular-nums">
           {j.placarCasa!==null&&j.placarFora!==null?j.placarCasa+" × "+j.placarFora:"×"}
         </div>
         <div className="text-[10px] text-muted-foreground">{j.periodo?j.periodo.replace(/_/g," "):new Date(j.partidaEm).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</div>
       </div>
       {renderClub(j.fora,j.posicaoFora)}
      </div>
      {j.fonte&&<a href={j.fonte} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[11px] text-primary hover:underline">Acompanhar no ge</a>}
    </CardContent>
   </Card>)}
  </div>
 </section>;
}

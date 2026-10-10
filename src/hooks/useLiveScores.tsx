import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
export interface LiveScore {
  pontos:number;jogou:boolean;scout:Record<string,number>|null;
  atualizado_em:string;prev?:number;changedAt?:number;
}
export interface UseLiveScoresResult {
  scores:Map<number,LiveScore>;rodada:number|null;online:boolean;lastUpdate:number|null;
}
export function useLiveScores():UseLiveScoresResult {
  const [scores,setScores]=useState<Map<number,LiveScore>>(new Map());
  const [rodada,setRodada]=useState<number|null>(null);
  const [online,setOnline]=useState(false);
  const [lastUpdate,setLastUpdate]=useState<number|null>(null);
  useEffect(()=>{
    let mounted=true,busy=false;
    const refresh=async()=>{
      if(!mounted||busy||document.visibilityState==="hidden")return;
      busy=true;
      try{
        const response=await fetch("/api/live");
        if(!response.ok)throw new Error("Parciais indisponíveis");
        const data=await response.json();
        if(!mounted)return;
        setRodada(data.rodada??null);
        setScores(old=>{
          const next=new Map<number,LiveScore>();
          for(const row of data.scores||[]){
            const id=Number(row.atleta_id);
            const p=Number(row.pontos)||0;
            const prior=old.get(id);
            next.set(id,{
              pontos:p,jogou:!!row.jogou,scout:row.scout||null,atualizado_em:row.atualizado_em,
              prev:prior?.pontos,changedAt:prior&&prior.pontos!==p?Date.now():prior?.changedAt
            });
          }
          return next;
        });
        setOnline(true);setLastUpdate(Date.now());
      }catch(err){
        console.warn("Parciais Globo indisponíveis. Tentando Neon:",err);
        try {
          const {data:m}=await supabase.from("mercado_status").select("rodada_atual").order("created_at",{ascending:false}).limit(1).maybeSingle();
          if(m?.rodada_atual){
            const {data:rows,error}=await supabase.from("atleta_parciais").select("atleta_id,pontos,scout,jogou,atualizado_em").eq("rodada",m.rodada_atual);
            if(!error&&mounted){
              setRodada(m.rodada_atual);
              setScores(new Map((rows||[]).map((x:any)=>[x.atleta_id,{pontos:Number(x.pontos)||0,jogou:!!x.jogou,scout:x.scout,atualizado_em:x.atualizado_em}])));
              setLastUpdate(Date.now());setOnline(false);
            }
          }
        }catch(e){console.warn("Fallback Neon não disponível",e);if(mounted)setOnline(false);}
      }finally{busy=false;}
    };
    void refresh();
    const timer=window.setInterval(refresh,25000);
    document.addEventListener("visibilitychange",refresh);
    return()=>{mounted=false;clearInterval(timer);document.removeEventListener("visibilitychange",refresh);};
  },[]);
  return {scores,rodada,online,lastUpdate};
}

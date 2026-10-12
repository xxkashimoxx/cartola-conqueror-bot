import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy, Shield, Flame, Scale, Loader2, Save, GitCompare, ArrowRightLeft, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Strategy = "balanceada" | "ofensiva" | "defensiva";

interface Atleta {
  id: number;
  apelido: string;
  posicao_id: number | null;
  clube_id: number | null;
  preco: number | null;
  media: number | null;
  jogos: number | null;
  status_id: number | null;
  predictedScore?: number;
  volatility?: number;
  reason?: string;
  opponent?: string | null;
  confidence?: string;
}

interface Clube {
  id: number;
  abreviacao: string;
}
type Scoreboard = {
  total:number|null; base:number|null; captainBonus:number|null; captainId:number|null;
  coverage:number; status:string; source:string;
  players:{id:number;counted:number;captain:boolean;fromBench:boolean}[];
  bench:{id:number;entered:boolean}[];
  substitutions:{outId:number;inId:number;position:number;captain:boolean}[];
};
type SavedRow = {
  tipo:string; atleta_ids:number[]; reservas_ids?:number[]; estrategia?:string;
  captain_id:number|null; updated_at:string; valor_total:number; score?:Scoreboard|null;
};

const POS_LABEL: Record<number, string> = { 1: "GOL", 2: "LAT", 3: "ZAG", 4: "MEI", 5: "ATA", 6: "TEC" };
const BENCH_POSITIONS = [1, 2, 3, 4, 5] as const;
type BenchIds = (number | null)[];


const STRATEGIES: Record<Strategy, { label: string; desc: string; icon: typeof Shield; color: string }> = {
  balanceada: { label: "Balanceada", desc: "Equilíbrio entre risco e segurança", icon: Scale, color: "text-neon-cyan" },
  ofensiva: { label: "Ofensiva", desc: "Alto potencial — risco médio", icon: Flame, color: "text-neon-pink" },
  defensiva: { label: "Defensiva", desc: "Pontuação segura e consistente", icon: Shield, color: "text-neon-green" },
};

const sumMedia = (l: Atleta[]) => l.reduce((s, a) => s + Number(a.predictedScore ?? a.media ?? 0), 0);
const sumPreco = (l: Atleta[]) => l.reduce((s, a) => s + Number(a.preco ?? 0), 0);
const projectedWithCaptain = (lineup:Atleta[],id:number|null) => {
 const eligible=lineup.filter(p=>p.posicao_id!==6);
 const captain=eligible.find(p=>p.id===id);
 return sumMedia(lineup)+Number(captain?.predictedScore??captain?.media??0)*.5;
};
const eligibleBench = (player:Atleta,position:number,lineup:Atleta[]) =>
  player.posicao_id===position&&player.status_id===7&&Number(player.preco)>0&&
  Math.round(Number(player.preco)*100)<=Math.round(Math.min(...lineup.filter(a=>a.posicao_id===position).map(a=>Number(a.preco)))*100);
const fillBench = (lineup:Atleta[],existing:BenchIds,athletes:Atleta[]):BenchIds => {
  const taken=new Set(lineup.map(a=>a.id));
  return BENCH_POSITIONS.map((position,index)=>{
    const current=athletes.find(a=>a.id===existing[index]);
    if(current&&eligibleBench(current,position,lineup)&&!taken.has(current.id)){
      taken.add(current.id);return current.id;
    }
    const best=athletes.filter(a=>eligibleBench(a,position,lineup)&&!taken.has(a.id))
      .sort((a,b)=>Number(b.predictedScore??b.media??0)-Number(a.predictedScore??a.media??0))[0];
    if(best)taken.add(best.id);
    return best?.id??null;
  });
};

const TeamBuilder = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [strategy, setStrategy] = useState<Strategy>("balanceada");
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [clubes, setClubes] = useState<Record<number, Clube>>({});
  const [loading, setLoading] = useState(true);
  const [rodada, setRodada] = useState<number>(0);
  const [myLineup, setMyLineup] = useState<Atleta[]>([]);
  const [reserveIds,setReserveIds]=useState<BenchIds>([null,null,null,null,null]);
  const [suggestedReserveIds,setSuggestedReserveIds]=useState<BenchIds>([null,null,null,null,null]);
  const [swapping, setSwapping] = useState<Atleta | null>(null);
  const [benchSwapping,setBenchSwapping]=useState<number|null>(null);
  const [saving, setSaving] = useState(false);
  const [budget, setBudget] = useState(100);
  const [recommended,setRecommended] = useState<Atleta[]>([]);
  const [optimizing,setOptimizing]=useState(false);
  const [optimizerError,setOptimizerError]=useState<string|null>(null);
  const [captainId,setCaptainId]=useState<number|null>(null);
  const [suggestedCaptainId,setSuggestedCaptainId]=useState<number|null>(null);
  const [savedTeam,setSavedTeam]=useState<{ids:number[];reserves:number[];captainId:number|null;updatedAt:string;strategy:Strategy}|null>(null);
  const [savedLoaded,setSavedLoaded]=useState(false);
  const [pendingModeDraft,setPendingModeDraft]=useState(false);
  const [actualScore,setActualScore]=useState<Scoreboard|null>(null);
  const [actualLoading,setActualLoading]=useState(false);
  const [marketOpen,setMarketOpen]=useState(false);
  const [optimizerContext,setOptimizerContext]=useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: ats }, { data: cls }, { data: mercado }] = await Promise.all([
        supabase.from("atletas").select("id,apelido,posicao_id,clube_id,preco,media,jogos,status_id").limit(1000),
        supabase.from("clubes").select("id,abreviacao"),
        supabase.from("mercado_status").select("rodada_atual").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setAtletas((ats as Atleta[]) ?? []);
      const map: Record<number, Clube> = {};
      (cls as Clube[] | null)?.forEach((c) => (map[c.id] = c));
      setClubes(map);
      setRodada(mercado?.rodada_atual ?? 0);
      setLoading(false);
    })();
  }, []);

  // Server-side optimizer: current opponent + recent historic points + constrained squad selection.
  useEffect(() => {
    if(!rodada||!atletas.length)return;
    const controller=new AbortController();
    let alive=true;
    (async()=>{
      setOptimizing(true);setOptimizerError(null);
      try{
        const response=await fetch("/api/recommend?mode="+strategy+"&budget="+budget,{signal:controller.signal,credentials:"same-origin",cache:"no-store"});
        const data=await response.json();
        if(!response.ok)throw Error(data.error||"Erro no algoritmo");
        if(!alive)return;
        const projected=data.players as Atleta[];
        const suggested=BENCH_POSITIONS.map((_,index)=>Number(data.reserves?.[index]?.id)||null);
        setRecommended(projected);
        setSuggestedReserveIds(suggested);
        if(pendingModeDraft){
          setMyLineup(projected);
          setReserveIds(suggested);
          setCaptainId(data.captainId||null);
          setPendingModeDraft(false);
        }
        if(Array.isArray(data.projections)){
          const projectedMap=new Map<number,Partial<Atleta>>(data.projections.map((p:Partial<Atleta>&{id:number})=>[Number(p.id),p]));
          setAtletas(previous=>previous.map(a=>({...a,...(projectedMap.get(a.id)||{})})));
        }
        setSuggestedCaptainId(data.captainId||null);
        setMarketOpen(!!data.mercadoAberto);
        setOptimizerContext(data.cardsReviewed+" atletas analisados · "+data.teamsUsed+" clubes · formação "+data.formation);
      }catch(error){
        if(!alive||controller.signal.aborted)return;
        setPendingModeDraft(false);
        setOptimizerError(error instanceof Error?error.message:"Erro ao otimizar");
      }finally{if(alive)setOptimizing(false);}
    })();
    return()=>{alive=false;controller.abort()};
  },[rodada,atletas.length,strategy,budget]);

  // The saved roster is the owner's source of truth; changing modes never modifies it.
  useEffect(()=>{
    if(!user||!rodada||!atletas.length)return;
    let active=true;
    setSavedLoaded(false);
    (async()=>{
      try{
        const response=await fetch("/api/lineups?rodada="+rodada,{credentials:"same-origin",cache:"no-store"});
        if(!response.ok)throw Error("Falha ao carregar o time salvo.");
        const payload=await response.json();
        const mine=((payload.rows||[]) as SavedRow[]).find(r=>r.tipo==="minha");
        if(!active)return;
        if(mine?.atleta_ids?.length===12){
          const storedStrategy: Strategy = ["balanceada","ofensiva","defensiva"].includes(mine.estrategia)
            ? mine.estrategia as Strategy
            : "balanceada";
          setStrategy(storedStrategy);
          const map=new Map(atletas.map(a=>[a.id,a]));
          const stored=mine.atleta_ids.map((id:number)=>map.get(id)).filter(Boolean) as Atleta[];
          const storedReserves=BENCH_POSITIONS.map((_,index)=>Number(mine.reservas_ids?.[index])||null);
          setSavedTeam({ids:mine.atleta_ids,reserves:mine.reservas_ids||[],captainId:mine.captain_id??null,updatedAt:mine.updated_at,strategy:storedStrategy});
          setBudget(previous=>Math.max(previous,Math.ceil((Number(mine.valor_total)||0)*2)/2));
          if(stored.length===12)setMyLineup(stored);
          setReserveIds(storedReserves);
          setCaptainId(mine.captain_id??null);
          setActualScore(mine.score||null);
        }else{
          setSavedTeam(null);
          setMyLineup([]);
          setReserveIds([null,null,null,null,null]);
          setCaptainId(null);
        }
      }catch(e){
        console.warn("Falha na recuperação de Meu Time",e);
        // Avoid overwriting a possible saved team when the backend is unreachable.
      }finally{if(active)setSavedLoaded(true);}
    })();
    return()=>{active=false};
  },[user?.id,rodada,atletas.length]);

  useEffect(()=>{
    if(savedLoaded&&!savedTeam&&!pendingModeDraft&&recommended.length&&myLineup.length===0){
      setMyLineup(recommended);
      setReserveIds(suggestedReserveIds);
      setCaptainId(suggestedCaptainId);
    }
  },[savedLoaded,savedTeam,recommended,myLineup.length,suggestedCaptainId,suggestedReserveIds,pendingModeDraft]);

  // Fill empty slots for older saved teams once this mode's projections are available.
  useEffect(()=>{
    if(!savedLoaded||optimizing||pendingModeDraft||myLineup.length!==12||!reserveIds.some(id=>id===null))return;
    setReserveIds(current=>{
      const next=fillBench(myLineup,current,atletas);
      return next.every((id,index)=>id===current[index])?current:next;
    });
  },[savedLoaded,optimizing,pendingModeDraft,myLineup,atletas,reserveIds]);

  // Recalculate the hypothetical score for the exact current draft, including captain.
  useEffect(()=>{
    if(!rodada||myLineup.length!==12||!savedLoaded)return;
    setActualScore(null);
    let active=true;
    const controller=new AbortController();
    const refresh=async()=>{
      if(!active||document.visibilityState==="hidden")return;
      setActualLoading(true);
      try{
        const response=await fetch("/api/score",{method:"POST",credentials:"same-origin",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({rodada,ids:myLineup.map(a=>a.id),reserves:reserveIds.every(id=>id!==null)?reserveIds:[],captainId}),signal:controller.signal});
        const result=await response.json();
        if(active&&response.ok)setActualScore(result);
      }catch(e){if(active&&!controller.signal.aborted)console.warn("Pontuação temporariamente indisponível",e)}
      finally{if(active)setActualLoading(false);}
    };
    void refresh();
    const interval=window.setInterval(refresh,25000);
    document.addEventListener("visibilitychange",refresh);
    return()=>{active=false;controller.abort();window.clearInterval(interval);document.removeEventListener("visibilitychange",refresh)};
  },[rodada,savedLoaded,captainId,myLineup.map(a=>a.id).join(","),reserveIds.join(",")]);

  const isSavedCurrent=!!savedTeam&&myLineup.length===12&&
    myLineup.every((a,i)=>a.id===savedTeam.ids[i])&&
    reserveIds.every((id,index)=>id===savedTeam.reserves[index])&&
    captainId===savedTeam.captainId&&strategy===savedTeam.strategy;
  const handleStrategyChange=(nextStrategy:Strategy)=>{
    if(nextStrategy===strategy||loading||!savedLoaded)return;
    setActualScore(null);
    setPendingModeDraft(true);
    setMyLineup([]);
    setReserveIds([null,null,null,null,null]);
    setCaptainId(null);
    setStrategy(nextStrategy);
  };
  const handleSwap = (newAtleta: Atleta) => {
    if (!swapping) return;
    const next=myLineup.map((a) => (a.id === swapping.id ? newAtleta : a));
    setActualScore(null);
    setMyLineup(next);
    setReserveIds(current=>fillBench(next,current,atletas));
    setSwapping(null);
  };
  const handleBenchSwap=(newAtleta:Atleta)=>{
    if(benchSwapping===null)return;
    setActualScore(null);
    setReserveIds(current=>current.map((id,index)=>BENCH_POSITIONS[index]===benchSwapping?newAtleta.id:id));
    setBenchSwapping(null);
  };

  const handleReset = () => {
    if(recommended.length!==12)return;
    setActualScore(null);
    setPendingModeDraft(false);
    setMyLineup(recommended);
    setReserveIds(suggestedReserveIds);
    setCaptainId(suggestedCaptainId);
    toast({ title: "Sugestão aplicada ao rascunho", description: "Clique em Salvar para fixar este time na rodada." });
  };

  const handleSave = async () => {
    if (!user) {
      toast({ title: "Faça login", description: "Precisa estar logado pra salvar.", variant: "destructive" });
      return;
    }
    if (!rodada) {
      toast({ title: "Sem rodada", description: "Sincronize o mercado primeiro.", variant: "destructive" });
      return;
    }
    setSaving(true);
    let error:Error|null=null;
    if(myLineup.length!==12||recommended.length!==12){
      error=new Error("Escalação incompleta: são necessários 11 atletas e um técnico.");
    }else if(reserveIds.some(id=>id===null)){
      error=new Error("Preencha as cinco vagas do banco de reservas.");
    }else if(reserveIds.some((id,index)=>{
      const athlete=atletas.find(a=>a.id===id);
      return !athlete||!eligibleBench(athlete,BENCH_POSITIONS[index],myLineup);
    })||
      new Set([...myLineup.map(a=>a.id),...reserveIds]).size!==17){
      error=new Error("Revise os reservas: cada um precisa ser da posição certa, custar até o titular mais barato e não pode se repetir.");
    }else if(captainId===null||!myLineup.some(a=>a.id===captainId&&a.posicao_id!==6)){
      error=new Error("Escolha o capitão antes de salvar (o técnico não pode ser capitão).");
    }else if(sumPreco(myLineup)>budget){
      error=new Error("Seu time excedeu o patrimônio informado.");
    }else{
      try{
        const result=await fetch("/api/lineups",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({rodada,estrategia:strategy,
             mine:{ids:myLineup.map(a=>a.id),reserves:reserveIds,captainId,score:myTotal,price:sumPreco(myLineup)},
            recommended:{ids:recommended.map(a=>a.id),captainId:suggestedCaptainId,score:projectedWithCaptain(recommended,suggestedCaptainId),price:sumPreco(recommended)}})});
        const data=await result.json();if(!result.ok)throw Error(data.error||"Erro ao salvar");
        setSavedTeam({ids:myLineup.map(a=>a.id),reserves:reserveIds as number[],captainId,updatedAt:new Date().toISOString(),strategy});
        if(data.score)setActualScore(data.score);
      }catch(e){error=e instanceof Error?e:new Error("Falha de rede")}
    }
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Escalação salva!", description: `Rodada ${rodada} guardada com sucesso.` });
    }
  };

  const detailedLineup=myLineup.map(a=>atletas.find(x=>x.id===a.id)||a);
  const substitutions=actualScore?.substitutions||[];
  const effectiveLineup=detailedLineup.map(a=>{
    const substitute=substitutions.find(s=>s.outId===a.id);
    return substitute?(atletas.find(x=>x.id===substitute.inId)||a):a;
  });
  const effectiveCaptain=actualScore?.status?actualScore.captainId as number|null:captainId;
  const myTotal=projectedWithCaptain(effectiveLineup,effectiveCaptain);
  const myPrice=sumPreco(myLineup);
  const recIds=new Set(recommended.map(a=>a.id));

  // Para o swap dialog: alternativas na mesma posição
  const swapOptions = useMemo(() => {
    if (!swapping) return [] as Atleta[];
    const pos = swapping.posicao_id;
    return atletas
      .filter((a) => a.posicao_id === pos && a.id !== swapping.id && a.status_id === 7 && (a.jogos ?? 0) >= 2)
      .sort((a, b) => Number(b.predictedScore ?? b.media ?? 0) - Number(a.predictedScore ?? a.media ?? 0))
      .slice(0, 30);
  }, [swapping, atletas]);
  const benchOptions=useMemo(()=>{
    if(benchSwapping===null||myLineup.length!==12)return [] as Atleta[];
    return atletas.filter(a=>eligibleBench(a,benchSwapping,myLineup))
      .sort((a,b)=>Number(b.predictedScore??b.media??0)-Number(a.predictedScore??a.media??0))
      .slice(0,40);
  },[benchSwapping,atletas,myLineup]);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="border-border">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            <h1 className="text-2xl font-black text-neon-cyan uppercase tracking-wider">
              CONSTRUTOR DE TIME
            </h1>
            {rodada > 0 && <Badge variant="outline" className="text-xs">Rodada {rodada}</Badge>}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/historico")} variant="outline" className="border-border">
              <GitCompare className="mr-2 h-4 w-4" /> Histórico
            </Button>
            <Button onClick={handleReset} variant="outline" disabled={optimizing||pendingModeDraft||recommended.length!==12} className="border-border">
              <ArrowRightLeft className="mr-2 h-4 w-4" /> Voltar à sugestão
            </Button>
            <Button onClick={handleSave} disabled={saving||loading||pendingModeDraft||optimizing||myLineup.length!==12||reserveIds.some(id=>id===null)} className="bg-primary hover:bg-primary/80 font-bold shadow-neon">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Card className="border-primary/50 p-4 mb-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-bold text-lg">Patrimônio para montar o time</h2>
              <p className="text-xs text-muted-foreground">2026 começa com C$ 100. Ajuste para o saldo real do seu time no Cartola.</p>
            </div>
            <label className="text-sm flex items-center gap-2">
              C$ <input className="w-28 rounded bg-background border border-border px-3 py-2 text-foreground" type="number"
                min="35" max="1000" step="0.5" value={budget}
                onChange={(e)=>setBudget(Math.min(1000,Math.max(35,Number(e.target.value)||100)))}/>
            </label>
          </div>
          {!marketOpen&&<p className="text-sm text-amber-500 font-semibold">Mercado fechado: sugestões simuladas para estudo da rodada. Não é possível confirmar no Cartola agora.</p>}
          {optimizing&&<p className="text-sm text-primary flex gap-2 items-center"><Loader2 className="w-4 h-4 animate-spin"/> Calculando combinações sob orçamento e adversários...</p>}
          {optimizerContext&&<p className="text-xs text-muted-foreground">{optimizerContext} · Capitão sugerido: {recommended.find(a=>a.id===captainId)?.apelido||"—"} (1,5×)</p>}
          {optimizerError&&<p className="text-sm text-destructive">{optimizerError}</p>}
        </Card>
        {savedTeam && (
          <Card className="p-4 mb-4 border-neon-green/50 bg-neon-green/5">
            <div className="flex justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-bold text-neon-green">Meu Time salvo · rodada {rodada}</p>
                <p className="text-xs text-muted-foreground">Titulares, capitão, modo e banco de reservas ficam armazenados no Neon.</p>
                {savedTeam.captainId===null&&<p className="text-xs text-amber-500 mt-1">Escolha um capitão e clique em Salvar para registrar o bônus oficial de 50%.</p>}
              </div>
              <Badge variant="outline" className={isSavedCurrent?"border-neon-green text-neon-green":"border-amber-500 text-amber-500"}>
                {isSavedCurrent?"Salvo e fixo":"Rascunho alterado · clique em Salvar"}
              </Badge>
            </div>
          </Card>
        )}
        <Card className="p-5 mb-5 border-primary/40 space-y-3">
          <div className="flex flex-wrap justify-between gap-3 items-start">
            <div>
              <h2 className="text-lg font-black">Pontuação com substituições do banco</h2>
              <p className="text-xs text-muted-foreground">Rodada {rodada} · {actualScore?.source || "Consultando Cartola FC"} · {isSavedCurrent?"time salvo":"rascunho atual"}</p>
            </div>
            <Badge variant="outline">{actualScore?.status==="encerrada"?"Resultado da rodada":actualScore?.status?.includes("parcial")?"Pontuação parcial / ao vivo":"Aguardando dados"}</Badge>
          </div>
          <div className="flex flex-wrap gap-6 items-baseline">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Total calculado</p>
              <p className="text-3xl font-black text-neon-green">{actualScore?.total==null?"—":Number(actualScore.total).toFixed(2)} <span className="text-base">pts</span></p>
            </div>
            <div><p className="text-xs text-muted-foreground uppercase">Pontos dos atletas em campo</p><p className="text-xl font-bold">{actualScore?.base==null?"—":Number(actualScore.base).toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Bônus do capitão</p><p className="text-xl font-bold">{actualScore?.captainBonus==null?"Escolha o capitão":Number(actualScore.captainBonus).toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Atletas com parcial</p><p className="text-xl font-bold">{actualScore?.coverage??0}/12</p></div>
          </div>
           <p className="text-xs text-muted-foreground">Scouts oficiais da rodada; a troca é aplicada após confirmar que o titular não atuou e que o reserva pontuou acima de zero. Enquanto faltam jogos ou parciais, o total é provisório.</p>
           {substitutions.length>0&&(
             <div className="rounded border border-neon-green/40 bg-neon-green/5 p-3 text-sm">
               <p className="font-bold text-neon-green">Substituições automáticas</p>
               {substitutions.map(s=><p key={s.outId}>
                 {myLineup.find(a=>a.id===s.outId)?.apelido||s.outId} → {atletas.find(a=>a.id===s.inId)?.apelido||s.inId}
                 {s.captain?" · reserva assumiu a braçadeira":""}
               </p>)}
             </div>
           )}
          {actualLoading && <p className="text-xs text-primary flex gap-2 items-center"><Loader2 className="h-3 w-3 animate-spin"/> Atualizando pontuação...</p>}
          {actualScore?.players?.length>0&&(
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {actualScore.players.map(p=>{
                 const a=atletas.find(x=>x.id===p.id)||myLineup.find(x=>x.id===p.id);
                return <div key={p.id} className="rounded border border-border bg-background/50 p-2 flex items-center justify-between gap-2 text-xs">
                   <span className="min-w-0 truncate">{p.captain?"(C) ":""}{a?.apelido||p.id}{p.fromBench?" · reserva":""}</span>
                  <span className="font-bold tabular-nums">{Number(p.counted).toFixed(2)}</span>
                </div>;
              })}
            </div>
          )}
        </Card>
        <div className="mb-3">
          <h2 className="text-lg font-black uppercase tracking-wide">Modo da escalação</h2>
          <p className="text-sm text-muted-foreground">Escolher outro modo monta uma nova sugestão. Seu time salvo só muda quando você clicar em Salvar.</p>
        </div>
        {/* Strategy Selector */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {(Object.keys(STRATEGIES) as Strategy[]).map((key) => {
            const s = STRATEGIES[key];
            const Icon = s.icon;
            const active = strategy === key;
            return (
              <button
                key={key}
                onClick={() => handleStrategyChange(key)}
                aria-pressed={active}
                disabled={loading || !savedLoaded || !rodada || saving}
                className={cn(
                  "relative text-left rounded-lg border-2 p-5 transition-all disabled:opacity-60",
                  active ? "border-primary bg-primary/10 shadow-neon" : "border-border bg-card/50 hover:border-primary/50"
                )}
              >
                {active && <Badge className="absolute right-3 top-3 bg-primary text-primary-foreground">Selecionado</Badge>}
                <Icon className={cn("h-8 w-8 mb-3", s.color)} />
                <div className="text-lg font-black uppercase tracking-wide">{s.label}</div>
                <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
              </button>
            );
          })}
        </div>

        <div className="mb-3">
          <h2 className="text-lg font-black uppercase tracking-wide">Seu time para a rodada</h2>
          <p className="text-sm text-muted-foreground">Uma escalação editável. Clique em um atleta para trocar por outro da mesma posição.</p>
        </div>
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-card border-border p-5 text-center">
            <Trophy className="h-7 w-7 text-neon-green mx-auto mb-1" />
            <div className="text-2xl font-black text-neon-green">{myTotal.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground uppercase">Pontos projetados com trocas confirmadas</p>
          </Card>
          <Card className="bg-card border-border p-5 text-center">
            <div className="text-2xl font-black text-foreground">C$ {myPrice.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground uppercase">Valor do time</p>
          </Card>
          <Card className="bg-card border-border p-5 text-center">
            <div
              className={cn(
                "text-2xl font-black",
                budget - myPrice >= 0 ? "text-foreground" : "text-destructive"
              )}
            >
              C$ {(budget - myPrice).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground uppercase">Saldo (Cap. {budget})</p>
          </Card>
        </div>

        {/* Minha Escalação editável */}
        {loading || !savedLoaded || pendingModeDraft ? (
          <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span>{pendingModeDraft ? `Montando a sugestão ${STRATEGIES[strategy].label}...` : "Carregando seu time..."}</span>
          </div>
        ) : myLineup.length === 0 ? (
          <Card className="p-8 text-center bg-card border-border">
            <p className="text-muted-foreground">Não foi possível montar uma escalação. Confira o aviso acima e ajuste o orçamento.</p>
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              Clique em um jogador pra trocar por outro da mesma posição.
            </p>
            <div className="space-y-2">
              {myLineup.map((a) => {
                const isRecommended = recIds.has(a.id);
                return (
                  <div key={a.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setSwapping(a)}
                    className="w-full text-left"
                  >
                    <Card
                      className={cn(
                        "border-border hover:border-primary transition-all p-4",
                        isRecommended ? "bg-card" : "bg-primary/5 border-primary/40"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="bg-primary text-primary-foreground font-black px-4 py-2 rounded uppercase text-sm min-w-[60px] text-center">
                            {POS_LABEL[a.posicao_id ?? 0] ?? "-"}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-lg font-bold text-foreground truncate flex items-center gap-2">
                              {a.apelido}
                              {!isRecommended && (
                                <Badge variant="outline" className="text-[10px] border-primary/50 text-neon-cyan">
                                  trocado
                                </Badge>
                              )}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {clubes[a.clube_id ?? 0]?.abreviacao ?? "-"} · {a.jogos ?? 0} jogos · Proj. {Number(a.predictedScore??a.media??0).toFixed(1)} pts
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <div className="text-2xl font-black text-neon-green">
                              {Number(a.media ?? 0).toFixed(1)}
                            </div>
                            <p className="text-xs text-muted-foreground uppercase">Média</p>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-bold text-foreground">
                              C$ {Number(a.preco ?? 0).toFixed(2)}
                            </div>
                            <p className="text-xs text-muted-foreground uppercase">Preço</p>
                          </div>
                          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Card>
                  </button>
                  {a.posicao_id !== 6 && (
                    <button type="button" onClick={()=>{setActualScore(null);setCaptainId(a.id);}}
                      className={cn("text-xs font-bold ml-2 mb-2 px-3 py-1.5 rounded-md border",
                        captainId===a.id?"text-neon-green border-neon-green/70 bg-neon-green/10":"text-muted-foreground border-border hover:border-primary")}>
                      {captainId===a.id?"Capitão escolhido (1,5×)":"Definir como capitão"}
                    </button>
                  )}
                  </div>
                );
              })}
            </div>
            <div className="mt-8 mb-3">
              <h2 className="text-lg font-black uppercase tracking-wide flex items-center gap-2"><Users className="h-5 w-5 text-neon-cyan"/> Banco de reservas</h2>
              <p className="text-sm text-muted-foreground">Cinco reservas, um por posição. Eles não consomem seu orçamento; cada um deve custar até o titular mais barato da posição. Clique para trocar a sugestão.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {BENCH_POSITIONS.map((position,index)=>{
                const reserve=atletas.find(a=>a.id===reserveIds[index]);
                const ceiling=Math.min(...myLineup.filter(a=>a.posicao_id===position).map(a=>Number(a.preco)));
                const entered=actualScore?.bench?.some(b=>b.id===reserve?.id&&b.entered);
                return <button type="button" key={position} onClick={()=>setBenchSwapping(position)}
                  className="text-left rounded-lg border border-border bg-card hover:border-primary transition-colors p-4">
                  <div className="flex justify-between items-center gap-2">
                    <Badge variant="outline">{POS_LABEL[position]}</Badge>
                    {entered&&<Badge className="bg-neon-green/20 text-neon-green">Entrou no time</Badge>}
                  </div>
                  <p className="font-bold mt-3 truncate">{reserve?.apelido||"Escolher reserva"}</p>
                  <p className="text-xs text-muted-foreground">{reserve?((clubes[reserve.clube_id??0]?.abreviacao||"—")+" · C$ "+Number(reserve.preco).toFixed(2)):"Vaga sem atleta"}</p>
                  <p className="text-xs text-muted-foreground mt-2">Limite C$ {ceiling.toFixed(2)} · projeção {Number(reserve?.predictedScore??reserve?.media??0).toFixed(1)} pts</p>
                  <span className="text-xs font-bold text-neon-cyan mt-3 inline-block">{reserve?"Trocar reserva":"Escalar reserva"}</span>
                </button>;
              })}
            </div>
            {reserveIds.some(id=>id===null)&&<p className="text-sm text-amber-500 mt-3">Preencha as vagas restantes com atletas elegíveis para salvar o banco.</p>}
          </>
        )}
      </div>

      {/* Swap Dialog */}
      <Dialog open={!!swapping||benchSwapping!==null} onOpenChange={(open) => {if(!open){setSwapping(null);setBenchSwapping(null);}}}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-neon-cyan uppercase">
              {benchSwapping!==null? `Reserva de ${POS_LABEL[benchSwapping]} · até C$ ${Math.min(...myLineup.filter(a=>a.posicao_id===benchSwapping).map(a=>Number(a.preco))).toFixed(2)}`:
                `Trocar ${swapping?.apelido} (${POS_LABEL[swapping?.posicao_id ?? 0]})`}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-1">
            {(benchSwapping!==null?benchOptions:swapOptions).map((o) => {
              const alreadyInLineup = myLineup.some((m) => m.id === o.id);
              const alreadyOnBench = reserveIds.some((id,index)=>id===o.id&&BENCH_POSITIONS[index]!==benchSwapping);
              const alreadySelected=benchSwapping!==null&&reserveIds[benchSwapping-1]===o.id;
              const disabled=alreadyInLineup||alreadyOnBench||alreadySelected;
              return (
                <button
                  key={o.id}
                  disabled={disabled}
                  onClick={() => benchSwapping!==null?handleBenchSwap(o):handleSwap(o)}
                  className={cn(
                    "w-full text-left bg-secondary/30 border border-border rounded p-3 transition-all",
                    disabled ? "opacity-40 cursor-not-allowed" : "hover:border-primary hover:bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{o.apelido}</p>
                      <p className="text-xs text-muted-foreground">
                        {clubes[o.clube_id ?? 0]?.abreviacao ?? "-"} · {o.jogos ?? 0} jogos · C$ {Number(o.preco ?? 0).toFixed(2)}
                        {alreadyInLineup?" · titular":alreadyOnBench?" · já no banco":alreadySelected?" · atual":""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-neon-green">{Number(o.media ?? 0).toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">Proj. {Number(o.predictedScore??o.media??0).toFixed(1)} pts</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamBuilder;

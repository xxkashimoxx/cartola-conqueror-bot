import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Zap, Trophy, Shield, Flame, Scale, Loader2, Save, GitCompare, ArrowRightLeft, Lock, Crown, TrendingUp, TrendingDown } from "lucide-react";
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

const POS_LABEL: Record<number, string> = { 1: "GOL", 2: "LAT", 3: "ZAG", 4: "MEI", 5: "ATA", 6: "TEC" };
const FORMATION: Record<number, number> = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 1 };


const STRATEGIES: Record<Strategy, { label: string; desc: string; icon: typeof Shield; color: string }> = {
  balanceada: { label: "Balanceada", desc: "Equilíbrio entre risco e segurança", icon: Scale, color: "text-neon-cyan" },
  ofensiva: { label: "Ofensiva", desc: "Alto potencial — risco médio", icon: Flame, color: "text-neon-pink" },
  defensiva: { label: "Defensiva", desc: "Pontuação segura e consistente", icon: Shield, color: "text-neon-green" },
};

const sumMedia = (l: Atleta[]) => l.reduce((s, a) => s + Number(a.predictedScore ?? a.media ?? 0), 0);
const sumPreco = (l: Atleta[]) => l.reduce((s, a) => s + Number(a.preco ?? 0), 0);
const projectedWithCaptain = (lineup:Atleta[],id:number|null=null) => {
 const eligible=lineup.filter(p=>p.posicao_id!==6);
 const captain=eligible.find(p=>p.id===id) || [...eligible].sort((a,b)=>Number(b.predictedScore??b.media??0)-Number(a.predictedScore??a.media??0))[0];
 return sumMedia(lineup)+Math.max(0,Number(captain?.predictedScore??captain?.media??0))*.5;
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
  const [swapping, setSwapping] = useState<Atleta | null>(null);
  const [saving, setSaving] = useState(false);
  const [budget, setBudget] = useState(100);
  const [recommended,setRecommended] = useState<Atleta[]>([]);
  const [optimizing,setOptimizing]=useState(false);
  const [optimizerError,setOptimizerError]=useState<string|null>(null);
  const [captainId,setCaptainId]=useState<number|null>(null);
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
        setRecommended(projected);
        setMyLineup(projected);
        if(Array.isArray(data.projections)){
          const projectedMap=new Map<number,any>(data.projections.map((p:any)=>[Number(p.id),p]));
          setAtletas(previous=>previous.map(a=>({...a,...(projectedMap.get(a.id)||{})})));
        }
        setCaptainId(data.captainId||null);
        setMarketOpen(!!data.mercadoAberto);
        setOptimizerContext(data.cardsReviewed+" atletas analisados · "+data.teamsUsed+" clubes · formação "+data.formation);
      }catch(error){
        if(!alive||controller.signal.aborted)return;
        setOptimizerError(error instanceof Error?error.message:"Erro ao otimizar");
      }finally{if(alive)setOptimizing(false);}
    })();
    return()=>{alive=false;controller.abort()};
  },[rodada,atletas.length,strategy,budget]);

  // Sincroniza minha escalação quando muda recomendada (primeira vez ou reset)
  useEffect(() => {
    if (recommended.length && myLineup.length === 0) {
      setMyLineup(recommended);
    }
  }, [recommended]);

  // Recover the private owner's previously saved lineup.
  useEffect(()=>{
    if(!user||!rodada||!atletas.length)return;
    let alive=true;
    (async()=>{
      try{
        const res=await fetch("/api/lineups?rodada="+rodada,{credentials:"same-origin"});
        if(!res.ok)return;
        const data=await res.json();
        const saved=(data.rows||[]).find((row:any)=>row.tipo==="minha");
        if(saved?.atleta_ids?.length===12&&alive){
          const map=new Map(atletas.map(a=>[a.id,a]));
          const lineup=saved.atleta_ids.map((id:number)=>map.get(id)).filter(Boolean);
          if(lineup.length===12)setMyLineup(lineup);
        }
      }catch(e){console.warn("Histórico indisponível",e)}
    })();return()=>{alive=false};
  },[user,rodada,atletas]);

  const handleSwap = (newAtleta: Atleta) => {
    if (!swapping) return;
    setMyLineup((cur) => cur.map((a) => (a.id === swapping.id ? newAtleta : a)));
    setSwapping(null);
  };

  const handleReset = () => {
    setMyLineup(recommended);
    toast({ title: "Escalação resetada", description: "Voltou pra recomendada." });
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
    }else if(sumPreco(myLineup)>budget){
      error=new Error("Seu time excedeu o patrimônio informado.");
    }else{
      try{
        const result=await fetch("/api/lineups",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({rodada,estrategia:strategy,
            mine:{ids:myLineup.map(a=>a.id),score:projectedWithCaptain(myLineup,captainId),price:sumPreco(myLineup)},
            recommended:{ids:recommended.map(a=>a.id),score:projectedWithCaptain(recommended,captainId),price:sumPreco(recommended)}})});
        const data=await result.json();if(!result.ok)throw Error(data.error||"Erro ao salvar");
      }catch(e){error=e instanceof Error?e:new Error("Falha de rede")}
    }
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Escalação salva!", description: `Rodada ${rodada} guardada com sucesso.` });
    }
  };

  // Comparação
  const myTotal = projectedWithCaptain(myLineup,captainId);
  const recTotal = projectedWithCaptain(recommended,captainId);
  const diff = myTotal - recTotal;
  const myPrice = sumPreco(myLineup);
  const recIds = new Set(recommended.map((a) => a.id));
  const myIds = new Set(myLineup.map((a) => a.id));
  const commonCount = [...myIds].filter((id) => recIds.has(id)).length;
  const changedCount = myLineup.length - commonCount;

  // Para o swap dialog: alternativas na mesma posição
  const swapOptions = useMemo(() => {
    if (!swapping) return [] as Atleta[];
    const pos = swapping.posicao_id;
    return atletas
      .filter((a) => a.posicao_id === pos && a.id !== swapping.id && a.status_id === 7 && (a.jogos ?? 0) >= 2)
      .sort((a, b) => Number(b.predictedScore ?? b.media ?? 0) - Number(a.predictedScore ?? a.media ?? 0))
      .slice(0, 30);
  }, [swapping, atletas]);

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
            <Button onClick={handleReset} variant="outline" className="border-border">
              <ArrowRightLeft className="mr-2 h-4 w-4" /> Resetar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/80 font-bold shadow-neon">
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
        {/* Strategy Selector */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {(Object.keys(STRATEGIES) as Strategy[]).map((key) => {
            const s = STRATEGIES[key];
            const Icon = s.icon;
            const active = strategy === key;
            return (
              <button
                key={key}
                onClick={() => setStrategy(key)}
                className={cn(
                  "text-left rounded-lg border-2 p-5 transition-all",
                  active ? "border-primary bg-card shadow-neon" : "border-border bg-card/50 hover:border-primary/50"
                )}
              >
                <Icon className={cn("h-8 w-8 mb-3", s.color)} />
                <div className="text-lg font-black uppercase tracking-wide">{s.label}</div>
                <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Comparação */}
        <Card className="bg-card border-2 border-primary/40 shadow-neon p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <GitCompare className="h-5 w-5 text-neon-cyan" />
            <h2 className="font-black uppercase tracking-wider text-neon-cyan">
              Minha Escalação vs Recomendada
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-secondary/40 border border-border rounded p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase">Minha (proj.)</p>
              <p className="text-2xl font-black text-foreground">{myTotal.toFixed(1)}</p>
            </div>
            <div className="bg-secondary/40 border border-border rounded p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase">Recomendada</p>
              <p className="text-2xl font-black text-neon-green">{recTotal.toFixed(1)}</p>
            </div>
            <div
              className={cn(
                "border-2 rounded p-3 text-center",
                diff >= 0 ? "border-neon-green/50 bg-neon-green/5" : "border-destructive/50 bg-destructive/5"
              )}
            >
              <p className="text-xs text-muted-foreground uppercase flex items-center justify-center gap-1">
                Diferença {diff >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              </p>
              <p className={cn("text-2xl font-black", diff >= 0 ? "text-neon-green" : "text-destructive")}>
                {diff >= 0 ? "+" : ""}{diff.toFixed(1)}
              </p>
            </div>
            <div className="bg-secondary/40 border border-border rounded p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase">Trocas</p>
              <p className="text-2xl font-black text-foreground">
                {changedCount}<span className="text-sm text-muted-foreground">/{myLineup.length}</span>
              </p>
            </div>
          </div>

          {/* Detalhamento jogador a jogador */}
          {changedCount > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-black uppercase tracking-wider text-neon-cyan mb-2 flex items-center gap-1">
                <Crown className="h-3 w-3" /> Diferenças jogador a jogador
              </p>
              <div className="space-y-1">
                {myLineup.map((mine, idx) => {
                  const rec = recommended[idx];
                  if (!rec || mine.id === rec.id) return null;
                  const delta = Number(mine.media ?? 0) - Number(rec.media ?? 0);
                  return (
                    <div key={mine.id} className="flex items-center justify-between text-xs bg-secondary/30 border border-border rounded p-2">
                      <span className="text-muted-foreground">
                        <span className="text-destructive line-through">{rec.apelido}</span>
                        {" → "}
                        <span className="text-foreground font-bold">{mine.apelido}</span>
                        <span className="text-muted-foreground"> ({POS_LABEL[mine.posicao_id ?? 0]})</span>
                      </span>
                      <span className={cn("font-black", delta >= 0 ? "text-neon-green" : "text-destructive")}>
                        {delta >= 0 ? "+" : ""}{delta.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-card border-border p-5 text-center">
            <Trophy className="h-7 w-7 text-neon-green mx-auto mb-1" />
            <div className="text-2xl font-black text-neon-green">{myTotal.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground uppercase">Média Projetada</p>
          </Card>
          <Card className="bg-card border-border p-5 text-center">
            <div className="text-2xl font-black text-foreground">C$ {myPrice.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground uppercase">Valor da Minha</p>
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
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : myLineup.length === 0 ? (
          <Card className="p-8 text-center bg-card border-border">
            <p className="text-muted-foreground">Sem dados. Sincronize o mercado no painel admin.</p>
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
                  <button
                    key={a.id}
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
                              {clubes[a.clube_id ?? 0]?.abreviacao ?? "-"} · {a.jogos ?? 0} jogos · Proj. {(a.predictedScore??a.media??0).toFixed(1)} pts
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
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Swap Dialog */}
      <Dialog open={!!swapping} onOpenChange={(o) => !o && setSwapping(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-neon-cyan uppercase">
              Trocar {swapping?.apelido} ({POS_LABEL[swapping?.posicao_id ?? 0]})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-1">
            {swapOptions.map((o) => {
              const delta = Number(o.media ?? 0) - Number(swapping?.media ?? 0);
              const alreadyInLineup = myLineup.some((m) => m.id === o.id);
              return (
                <button
                  key={o.id}
                  disabled={alreadyInLineup}
                  onClick={() => handleSwap(o)}
                  className={cn(
                    "w-full text-left bg-secondary/30 border border-border rounded p-3 transition-all",
                    alreadyInLineup ? "opacity-40 cursor-not-allowed" : "hover:border-primary hover:bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{o.apelido}</p>
                      <p className="text-xs text-muted-foreground">
                        {clubes[o.clube_id ?? 0]?.abreviacao ?? "-"} · {o.jogos ?? 0} jogos · C$ {Number(o.preco ?? 0).toFixed(2)}
                        {alreadyInLineup && " · já escalado"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-neon-green">{Number(o.media ?? 0).toFixed(1)}</p>
                      <p className={cn("text-xs font-bold", delta >= 0 ? "text-neon-green" : "text-destructive")}>
                        {delta >= 0 ? "+" : ""}{delta.toFixed(2)}
                      </p>
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

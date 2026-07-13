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
}

interface Clube {
  id: number;
  abreviacao: string;
}

const POS_LABEL: Record<number, string> = { 1: "GOL", 2: "LAT", 3: "ZAG", 4: "MEI", 5: "ATA", 6: "TEC" };
const FORMATION: Record<number, number> = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 1 };
const BUDGET = 140;

const STRATEGIES: Record<Strategy, { label: string; desc: string; icon: typeof Shield; color: string }> = {
  balanceada: { label: "Balanceada", desc: "Equilíbrio entre risco e segurança", icon: Scale, color: "text-neon-cyan" },
  ofensiva: { label: "Ofensiva", desc: "Alto potencial — risco médio", icon: Flame, color: "text-neon-pink" },
  defensiva: { label: "Defensiva", desc: "Pontuação segura e consistente", icon: Shield, color: "text-neon-green" },
};

function scoreAtleta(a: Atleta, strategy: Strategy): number {
  const media = Number(a.media ?? 0);
  const preco = Number(a.preco ?? 0);
  const jogos = Number(a.jogos ?? 0);
  const pos = a.posicao_id ?? 0;
  if (strategy === "ofensiva") {
    const boost = pos === 5 ? 1.35 : pos === 4 ? 1.15 : 1;
    return (media * boost) + (preco * 0.18);
  }
  if (strategy === "defensiva") {
    const boost = pos === 1 ? 1.25 : pos === 3 ? 1.2 : pos === 2 ? 1.15 : 1;
    return (media * boost) + Math.min(jogos, 15) * 0.18 - preco * 0.03;
  }
  return media + Math.min(jogos, 15) * 0.08;
}

function buildLineup(atletas: Atleta[], strategy: Strategy): Atleta[] {
  const provaveis = atletas.filter(
    (a) => (a.jogos ?? 0) >= 2 && (a.status_id === 7 || a.status_id === null || a.status_id === 0)
  );
  const byPos: Record<number, Atleta[]> = {};
  for (const a of provaveis) {
    const p = a.posicao_id ?? 0;
    if (!FORMATION[p]) continue;
    (byPos[p] ||= []).push(a);
  }
  for (const p in byPos) {
    byPos[+p].sort((x, y) => scoreAtleta(y, strategy) - scoreAtleta(x, strategy));
  }
  const picked: Atleta[] = [];
  for (const pos of Object.keys(FORMATION).map(Number)) {
    const need = FORMATION[pos];
    const pool = byPos[pos] || [];
    picked.push(...pool.slice(0, need));
  }
  let total = picked.reduce((s, a) => s + Number(a.preco ?? 0), 0);
  let guard = 0;
  while (total > BUDGET && guard < 50) {
    const sortedByCost = [...picked].sort((a, b) => Number(b.preco ?? 0) - Number(a.preco ?? 0));
    let swapped = false;
    for (const expensive of sortedByCost) {
      const pos = expensive.posicao_id ?? 0;
      const pool = byPos[pos] || [];
      const idx = pool.findIndex((x) => x.id === expensive.id);
      const next = pool.slice(idx + 1).find((cand) => !picked.some((p) => p.id === cand.id));
      if (next && Number(next.preco ?? 0) < Number(expensive.preco ?? 0)) {
        picked[picked.indexOf(expensive)] = next;
        total = picked.reduce((s, a) => s + Number(a.preco ?? 0), 0);
        swapped = true;
        break;
      }
    }
    if (!swapped) break;
    guard++;
  }
  return picked;
}

const sumMedia = (l: Atleta[]) => l.reduce((s, a) => s + Number(a.media ?? 0), 0);
const sumPreco = (l: Atleta[]) => l.reduce((s, a) => s + Number(a.preco ?? 0), 0);

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

  const recommended = useMemo(() => buildLineup(atletas, strategy), [atletas, strategy]);

  // Sincroniza minha escalação quando muda recomendada (primeira vez ou reset)
  useEffect(() => {
    if (recommended.length && myLineup.length === 0) {
      setMyLineup(recommended);
    }
  }, [recommended]);

  // Carregar escalação salva do usuário, se existir
  useEffect(() => {
    if (!user || !rodada || atletas.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("escalacoes_usuario")
        .select("atleta_ids")
        .eq("user_id", user.id)
        .eq("rodada", rodada)
        .eq("tipo", "minha")
        .maybeSingle();
      if (data?.atleta_ids?.length) {
        const map = new Map(atletas.map((a) => [a.id, a]));
        const saved = (data.atleta_ids as number[]).map((id) => map.get(id)).filter(Boolean) as Atleta[];
        if (saved.length) setMyLineup(saved);
      }
    })();
  }, [user, rodada, atletas]);

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
    const myPayload = {
      user_id: user.id,
      rodada,
      tipo: "minha" as const,
      estrategia: strategy,
      atleta_ids: myLineup.map((a) => a.id),
      pontos_esperados: Number(sumMedia(myLineup).toFixed(2)),
      valor_total: Number(sumPreco(myLineup).toFixed(2)),
    };
    const recPayload = {
      user_id: user.id,
      rodada,
      tipo: "recomendada" as const,
      estrategia: strategy,
      atleta_ids: recommended.map((a) => a.id),
      pontos_esperados: Number(sumMedia(recommended).toFixed(2)),
      valor_total: Number(sumPreco(recommended).toFixed(2)),
    };
    const { error } = await supabase
      .from("escalacoes_usuario")
      .upsert([myPayload, recPayload], { onConflict: "user_id,rodada,tipo" });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Escalação salva!", description: `Rodada ${rodada} guardada com sucesso.` });
    }
  };

  // Comparação
  const myTotal = sumMedia(myLineup);
  const recTotal = sumMedia(recommended);
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
      .filter((a) => a.posicao_id === pos && a.id !== swapping.id && (a.jogos ?? 0) >= 1)
      .sort((a, b) => Number(b.media ?? 0) - Number(a.media ?? 0))
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
                BUDGET - myPrice >= 0 ? "text-foreground" : "text-destructive"
              )}
            >
              C$ {(BUDGET - myPrice).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground uppercase">Saldo (Cap. {BUDGET})</p>
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
                              {clubes[a.clube_id ?? 0]?.abreviacao ?? "-"} · {a.jogos ?? 0} jogos
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

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Zap, Trophy, Shield, Flame, Scale, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
// 4-3-3
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
    // valoriza estrelas e setor ofensivo (MEI/ATA)
    const boost = pos === 5 ? 1.35 : pos === 4 ? 1.15 : 1;
    return (media * boost) + (preco * 0.18);
  }
  if (strategy === "defensiva") {
    // valoriza consistência (jogos) e setor defensivo (GOL/LAT/ZAG)
    const boost = pos === 1 ? 1.25 : pos === 3 ? 1.2 : pos === 2 ? 1.15 : 1;
    return (media * boost) + Math.min(jogos, 15) * 0.18 - preco * 0.03;
  }
  // balanceada
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

  // Greedy pick top N por posição, depois ajusta por orçamento trocando pelo próximo se estourar
  const picked: Atleta[] = [];
  for (const pos of Object.keys(FORMATION).map(Number)) {
    const need = FORMATION[pos];
    const pool = byPos[pos] || [];
    picked.push(...pool.slice(0, need));
  }

  // Ajuste orçamentário simples
  let total = picked.reduce((s, a) => s + Number(a.preco ?? 0), 0);
  let guard = 0;
  while (total > BUDGET && guard < 50) {
    // troca o mais caro pelo próximo da mesma posição
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

const TeamBuilder = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [strategy, setStrategy] = useState<Strategy>("balanceada");
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [clubes, setClubes] = useState<Record<number, Clube>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: ats }, { data: cls }] = await Promise.all([
        supabase.from("atletas").select("id,apelido,posicao_id,clube_id,preco,media,jogos,status_id").limit(1000),
        supabase.from("clubes").select("id,abreviacao"),
      ]);
      setAtletas((ats as Atleta[]) ?? []);
      const map: Record<number, Clube> = {};
      (cls as Clube[] | null)?.forEach((c) => (map[c.id] = c));
      setClubes(map);
      setLoading(false);
    })();
  }, []);

  const lineup = useMemo(() => buildLineup(atletas, strategy), [atletas, strategy]);
  const totalPrice = lineup.reduce((s, a) => s + Number(a.preco ?? 0), 0);
  const totalPredicted = lineup.reduce((s, a) => s + Number(a.media ?? 0), 0);

  const handleGenerate = () => {
    toast({ title: "Escalação gerada!", description: `Estratégia ${STRATEGIES[strategy].label}` });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="border-border">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <h1 className="text-2xl font-black text-neon-cyan uppercase tracking-wider">
              CONSTRUTOR DE TIME
            </h1>
          </div>
          <Button onClick={handleGenerate} className="bg-primary hover:bg-primary/80 font-bold shadow-neon">
            <Zap className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Strategy Selector */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
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
                  active
                    ? "border-primary bg-card shadow-neon"
                    : "border-border bg-card/50 hover:border-primary/50"
                )}
              >
                <Icon className={cn("h-8 w-8 mb-3", s.color)} />
                <div className="text-lg font-black uppercase tracking-wide">{s.label}</div>
                <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-card border-border p-6 text-center">
            <Trophy className="h-8 w-8 text-neon-green mx-auto mb-2" />
            <div className="text-3xl font-black text-neon-green">{totalPredicted.toFixed(1)}</div>
            <p className="text-sm text-muted-foreground uppercase">Média Projetada</p>
          </Card>
          <Card className="bg-card border-border p-6 text-center">
            <div className="text-3xl font-black text-foreground">C$ {totalPrice.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground uppercase">Valor Total</p>
          </Card>
          <Card className="bg-card border-border p-6 text-center">
            <div
              className={cn(
                "text-3xl font-black",
                BUDGET - totalPrice >= 0 ? "text-foreground" : "text-destructive"
              )}
            >
              C$ {(BUDGET - totalPrice).toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground uppercase">Saldo (Cap. {BUDGET})</p>
          </Card>
        </div>

        {/* Lineup */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : lineup.length === 0 ? (
          <Card className="p-8 text-center bg-card border-border">
            <p className="text-muted-foreground">Sem dados suficientes. Sincronize o mercado no painel admin.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {lineup.map((a) => (
              <Card
                key={a.id}
                className="bg-card border-border hover:border-primary transition-all duration-300 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="bg-primary text-primary-foreground font-black px-4 py-2 rounded uppercase text-sm min-w-[60px] text-center">
                      {POS_LABEL[a.posicao_id ?? 0] ?? "-"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-foreground truncate">{a.apelido}</h3>
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
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamBuilder;

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUserPlan } from "@/hooks/useUserPlan";
import { Flame, Lock, RefreshCw, Sparkles, Swords, Trophy, Crown } from "lucide-react";

interface Resumo {
  rodada: number;
  manchete: string;
  confrontos_principais: Array<{ jogo: string; analise: string }>;
  surpresas: Array<{ titulo: string; descricao: string }>;
  escalacao_free: { resumo: string; jogadores: string[] };
  escalacao_pro: { resumo: string; jogadores: string[]; diferencial: string };
}

const ResumoRodada = () => {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { plan } = useUserPlan();

  const isPaid = plan && plan !== "FREE";

  const load = async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      const { data, error: invErr } = await supabase.functions.invoke("resumo-rodada", {
        body: refresh ? { refresh: 1 } : {},
      });
      if (invErr) throw invErr;
      if (!data?.success) throw new Error(data?.error || "Erro ao gerar resumo");
      setResumo(data);
    } catch (e: any) {
      setError(e?.message || "Não rolou carregar o resumo");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <Card className="bg-card border-2 border-primary/40 shadow-neon">
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 text-neon-cyan animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">Mestre Cartoleiro analisando a rodada...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !resumo) {
    return (
      <Card className="bg-card border-2 border-destructive/40">
        <CardContent className="p-6 text-center space-y-3">
          <p className="text-destructive font-bold">{error || "Sem resumo disponível"}</p>
          <Button onClick={() => load(true)} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" /> Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-2 border-primary/50 shadow-neon overflow-hidden">
      <div className="bg-gradient-to-r from-primary/20 via-card to-card border-b-2 border-primary/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-lg border border-primary/40">
              <Sparkles className="h-5 w-5 text-neon-cyan" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                Resumo IA · Rodada {resumo.rodada}
              </div>
              <h3 className="text-foreground font-black text-lg md:text-xl leading-tight mt-1">
                {resumo.manchete}
              </h3>
            </div>
          </div>
          <Button
            onClick={() => load(true)}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="border-neon-cyan/50"
          >
            <RefreshCw className={`mr-2 h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Atualizando" : "Atualizar"}
          </Button>
        </div>
      </div>

      <CardContent className="p-5 md:p-6 grid gap-6 lg:grid-cols-3">
        {/* Confrontos */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-neon-red" />
            <h4 className="font-black uppercase text-sm tracking-wider text-neon-red">
              Confrontos da Rodada
            </h4>
          </div>
          <div className="space-y-2">
            {resumo.confrontos_principais.map((c, i) => (
              <div key={i} className="bg-secondary/40 border border-border rounded p-3">
                <div className="font-bold text-foreground text-sm">{c.jogo}</div>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{c.analise}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Surpresas */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-neon-yellow" />
            <h4 className="font-black uppercase text-sm tracking-wider text-neon-yellow">
              Surpresas Prováveis
            </h4>
          </div>
          <div className="space-y-2">
            {resumo.surpresas.map((s, i) => (
              <div key={i} className="bg-secondary/40 border border-border rounded p-3">
                <div className="font-bold text-foreground text-sm">{s.titulo}</div>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{s.descricao}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Escalações */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-neon-green" />
            <h4 className="font-black uppercase text-sm tracking-wider text-neon-green">
              Escalação Sugerida
            </h4>
          </div>

          {/* FREE */}
          <div className="bg-secondary/40 border border-border rounded p-3">
            <div className="flex items-center justify-between mb-1">
              <Badge variant="outline" className="text-xs">FREE</Badge>
              <span className="text-[10px] text-muted-foreground uppercase">Base segura</span>
            </div>
            <p className="text-muted-foreground text-xs mb-2 leading-relaxed">
              {resumo.escalacao_free.resumo}
            </p>
            <div className="flex flex-wrap gap-1">
              {resumo.escalacao_free.jogadores.map((j, i) => (
                <span key={i} className="text-[11px] bg-background border border-border px-2 py-0.5 rounded">
                  {j}
                </span>
              ))}
            </div>
          </div>

          {/* PRO */}
          <div className="bg-gradient-to-br from-primary/10 to-card border-2 border-primary/50 rounded p-3 relative">
            <div className="flex items-center justify-between mb-1">
              <Badge className="bg-primary text-primary-foreground text-xs gap-1">
                <Crown className="h-3 w-3" /> PRO
              </Badge>
              <span className="text-[10px] text-neon-cyan uppercase font-bold">Mitada</span>
            </div>

            {isPaid ? (
              <>
                <p className="text-muted-foreground text-xs mb-2 leading-relaxed">
                  {resumo.escalacao_pro.resumo}
                </p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {resumo.escalacao_pro.jogadores.map((j, i) => (
                    <span key={i} className="text-[11px] bg-background border border-primary/40 px-2 py-0.5 rounded text-foreground">
                      {j}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-neon-cyan italic border-t border-primary/30 pt-2">
                  💡 {resumo.escalacao_pro.diferencial}
                </p>
              </>
            ) : (
              <div className="text-center py-4">
                <Lock className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-bold text-foreground">Escalação PRO trancada</p>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Surpresas + mitadas + diferencial de quem amassa a liga.
                </p>
                <Button size="sm" className="bg-primary hover:bg-primary/80 text-xs">
                  Virar PRO
                </Button>
              </div>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
};

export default ResumoRodada;

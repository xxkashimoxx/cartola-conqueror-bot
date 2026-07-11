import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Radio,
  Shield,
  Users,
  Activity,
  Swords,
} from "lucide-react";

interface Snapshot {
  clubes: number;
  atletas: number;
  pontuacoes: number;
  partidas: number;
  rodadasComPontos: number;
  rodadaAtual: number | null;
}

interface SyncNowButtonProps {
  variant?: "default" | "outline";
  className?: string;
  label?: string;
  onDone?: () => void;
}

type StageKey = "mercado" | "clubes" | "atletas" | "pontuacoes" | "partidas";

const STAGES: { key: StageKey; label: string; icon: any; weight: number }[] = [
  { key: "mercado",    label: "Status do mercado",        icon: Radio,    weight: 5 },
  { key: "clubes",     label: "Clubes",                   icon: Shield,   weight: 5 },
  { key: "atletas",    label: "Atletas",                  icon: Users,    weight: 20 },
  { key: "pontuacoes", label: "Pontuações por rodada",    icon: Activity, weight: 40 },
  { key: "partidas",   label: "Partidas / confrontos",    icon: Swords,   weight: 30 },
];

async function readCounts(): Promise<Snapshot> {
  const [clubes, atletas, pontuacoes, partidas, rodadas, mercado] =
    await Promise.all([
      supabase.from("clubes").select("*", { count: "exact", head: true }),
      supabase.from("atletas").select("*", { count: "exact", head: true }),
      supabase.from("atleta_pontuacoes").select("*", { count: "exact", head: true }),
      supabase.from("partidas").select("*", { count: "exact", head: true }),
      supabase.from("atleta_pontuacoes").select("rodada").limit(10000),
      supabase.from("mercado_status").select("rodada_atual").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
  const uniqueRodadas = new Set((rodadas.data || []).map((r: any) => r.rodada));
  return {
    clubes: clubes.count ?? 0,
    atletas: atletas.count ?? 0,
    pontuacoes: pontuacoes.count ?? 0,
    partidas: partidas.count ?? 0,
    rodadasComPontos: uniqueRodadas.size,
    rodadaAtual: (mercado.data as any)?.rodada_atual ?? null,
  };
}

const SyncNowButton = ({
  variant = "outline",
  className,
  label = "Sincronizar agora",
  onDone,
}: SyncNowButtonProps) => {
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageStatus, setStageStatus] = useState<Record<StageKey, "pending" | "running" | "done">>({
    mercado: "pending", clubes: "pending", atletas: "pending", pontuacoes: "pending", partidas: "pending",
  });
  const [live, setLive] = useState<Snapshot | null>(null);
  const [baseline, setBaseline] = useState<Snapshot | null>(null);
  const [result, setResult] = useState<
    | null
    | { success: true; data: any }
    | { success: false; error: string }
  >(null);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const { toast } = useToast();

  const cleanup = () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (timerRef.current) window.clearInterval(timerRef.current);
    pollRef.current = null;
    timerRef.current = null;
  };

  useEffect(() => cleanup, []);

  const advanceStages = (snap: Snapshot, base: Snapshot) => {
    setStageStatus((prev) => {
      const next = { ...prev };
      // mercado: assume kicked off quase imediatamente
      next.mercado = "running";
      // clubes: mudou ou já existia
      if (snap.clubes >= base.clubes && snap.clubes > 0) {
        next.mercado = "done";
        next.clubes = next.clubes === "done" ? "done" : "running";
      }
      // atletas: contagem cresceu ou upsert já rodou (heurística: passou dos ~600)
      if (snap.atletas >= Math.max(base.atletas, 500)) {
        next.clubes = "done";
        next.atletas = next.atletas === "done" ? "done" : "running";
      }
      // pontuações: cresceu além do baseline
      if (snap.pontuacoes > base.pontuacoes) {
        next.atletas = "done";
        next.pontuacoes = "running";
      }
      // partidas: cresceu além do baseline
      if (snap.partidas > base.partidas) {
        next.pontuacoes = next.pontuacoes === "done" ? "done" : "running";
        next.partidas = "running";
      }
      return next;
    });

    // progresso ponderado
    const gainPont = Math.max(0, snap.pontuacoes - base.pontuacoes);
    const gainPart = Math.max(0, snap.partidas - base.partidas);
    let pct = 0;
    pct += 5; // mercado disparado
    if (snap.clubes > 0) pct += 5;
    if (snap.atletas > 0) pct += 20;
    pct += Math.min(40, (gainPont / 3000) * 40); // ~3k pontos estimado
    pct += Math.min(30, (gainPart / 380) * 30);
    setProgress(Math.min(97, Math.round(pct)));
  };

  const start = async () => {
    setOpen(true);
    setSyncing(true);
    setResult(null);
    setProgress(2);
    setElapsed(0);
    setStageStatus({ mercado: "running", clubes: "pending", atletas: "pending", pontuacoes: "pending", partidas: "pending" });

    const base = await readCounts();
    setBaseline(base);
    setLive(base);

    timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    pollRef.current = window.setInterval(async () => {
      try {
        const snap = await readCounts();
        setLive(snap);
        advanceStages(snap, base);
      } catch { /* ignore */ }
    }, 1800);

    try {
      const { data, error } = await supabase.functions.invoke("sync-cartola-data");
      if (error) throw error;
      setResult({ success: true, data });
      setStageStatus({ mercado: "done", clubes: "done", atletas: "done", pontuacoes: "done", partidas: "done" });
      setProgress(100);
      // snapshot final
      try { setLive(await readCounts()); } catch { /* ignore */ }
      toast({
        title: "Sincronização concluída",
        description: `Rodada ${data?.rodada ?? "?"} · ${data?.atletas ?? 0} atletas · ${data?.pontuacoes ?? 0} pontuações · ${data?.partidas ?? 0} partidas`,
      });
      onDone?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setResult({ success: false, error: msg });
      toast({ title: "Falha na sincronização", description: msg, variant: "destructive" });
    } finally {
      cleanup();
      setSyncing(false);
    }
  };

  const delta = (key: keyof Snapshot) =>
    live && baseline && typeof live[key] === "number" && typeof baseline[key] === "number"
      ? (live[key] as number) - (baseline[key] as number)
      : 0;

  return (
    <>
      <Button
        onClick={start}
        disabled={syncing}
        variant={variant}
        className={className}
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Sincronizando..." : label}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!syncing) setOpen(o); }}>
        <DialogContent className="max-w-lg bg-card border-2 border-neon-cyan/40">
          <DialogHeader>
            <DialogTitle className="text-neon-cyan flex items-center gap-2">
              <RefreshCw className={`h-5 w-5 ${syncing ? "animate-spin" : ""}`} />
              Sincronização Cartola FC
            </DialogTitle>
            <DialogDescription>
              Puxando dados oficiais da API do Cartola em tempo real.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progresso</span>
                <span>{progress}% · {elapsed}s</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <ul className="space-y-2">
              {STAGES.map((s) => {
                const st = stageStatus[s.key];
                const Icon = s.icon;
                return (
                  <li key={s.key} className="flex items-center gap-3 text-sm">
                    {st === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    ) : st === "running" ? (
                      <RefreshCw className="h-4 w-4 text-neon-cyan animate-spin shrink-0" />
                    ) : (
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className={st === "done" ? "text-foreground" : st === "running" ? "text-neon-cyan" : "text-muted-foreground"}>
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ul>

            {live && (
              <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded bg-background/60 border border-border">
                <div>
                  <div className="text-muted-foreground">Rodada atual</div>
                  <div className="text-neon-cyan font-bold text-lg">{live.rodadaAtual ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Rodadas com pontos</div>
                  <div className="text-foreground font-bold text-lg">{live.rodadasComPontos}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Atletas</div>
                  <div className="text-foreground font-semibold">
                    {live.atletas}
                    {delta("atletas") !== 0 && <span className="text-success ml-1">+{delta("atletas")}</span>}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Clubes</div>
                  <div className="text-foreground font-semibold">{live.clubes}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Pontuações</div>
                  <div className="text-foreground font-semibold">
                    {live.pontuacoes}
                    {delta("pontuacoes") > 0 && <span className="text-success ml-1">+{delta("pontuacoes")}</span>}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Partidas</div>
                  <div className="text-foreground font-semibold">
                    {live.partidas}
                    {delta("partidas") > 0 && <span className="text-success ml-1">+{delta("partidas")}</span>}
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div
                className={`p-3 rounded border flex items-start gap-2 text-sm ${
                  result.success
                    ? "bg-success/10 border-success/40 text-success"
                    : "bg-destructive/10 border-destructive/40 text-destructive"
                }`}
              >
                {result.success ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mt-0.5" />
                    <span>Dados do Cartola atualizados com sucesso.</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <span>{result.error}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SyncNowButton;

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Clock3, Radio, RefreshCw, Swords, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useLiveScores } from "@/hooks/useLiveScores";

type Clube = { id: number; nome: string; sigla: string; escudo: string | null };
type Partida = {
  id: number; rodada: number; casa: Clube; fora: Clube;
  placarCasa: number | null; placarFora: number | null;
  partidaEm: string; status: string; periodo: string | null; estadio: string | null;
};
type Atleta = {
  id: number; apelido: string; clube_id: number | null; posicao_id: number | null;
  media: number | null; foto_url: string | null; status_id: number | null;
};
type Rodada = { rodada: number; temporada: number; jogos: Partida[]; atualizadoEm: string; bolaRolando: boolean };
const POSICOES: Record<number, string> = { 1: "GOL", 2: "LAT", 3: "ZAG", 4: "MEI", 5: "ATA", 6: "TEC" };
const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dateTime = (value: string) => {
  if (!value || Number.isNaN(Date.parse(value))) return "Horário indisponível";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  });
};
function aoVivo(jogo: Partida) {
  return /ao vivo|em andamento|1º tempo|2º tempo|primeiro tempo|segundo tempo|intervalo|1t|2t/i.test(
    String(jogo.status || "") + " " + String(jogo.periodo || "")
  );
}

const Confrontos = () => {
  const navigate = useNavigate();
  const [rodada, setRodada] = useState<Rodada | null>(null);
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const { scores, rodada: rodadaParciais, online: parciaisOnline, lastUpdate: parciaisAtualizadas } = useLiveScores();

  useEffect(() => {
    let active = true;
    let busy = false;
    async function atualizarJogos() {
      if (!active || busy || document.visibilityState === "hidden") return;
      busy = true;
      setRefreshing(true);
      try {
        const response = await fetch("/api/brasileirao", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error("Não foi possível consultar os placares do Cartola FC.");
        const data = await response.json();
        if (!data.success || !Array.isArray(data.jogos)) throw new Error("Resposta inesperada da fonte oficial.");
        if (active) {
          setRodada(data);
          setError("");
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Confrontos indisponíveis.");
      } finally {
        busy = false;
        if (active) { setLoading(false); setRefreshing(false); }
      }
    }
    void atualizarJogos();
    const interval = window.setInterval(atualizarJogos, 20000);
    const onVisible = () => { if (document.visibilityState === "visible") void atualizarJogos(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  useEffect(() => {
    let active = true;
    async function atualizarAtletas() {
      const { data, error: dbError } = await supabase.from("atletas")
        .select("id,apelido,clube_id,posicao_id,media,foto_url,status_id").limit(4000);
      if (!active) return;
      if (dbError) {
        console.warn("Atletas no Neon indisponíveis", dbError);
        return;
      }
      setAtletas(Array.isArray(data) ? data.filter((a: Atleta) => Number.isSafeInteger(Number(a.id))) : []);
    }
    void atualizarAtletas();
    const interval = window.setInterval(atualizarAtletas, 300000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const partida = rodada?.jogos.find((jogo) => jogo.id === selectedId) ?? null;
  const parciaisDaRodada = rodadaParciais === rodada?.rodada && parciaisOnline;

  const atletasDoClube = (clubeId: number) => atletas.filter((a) => Number(a.clube_id) === clubeId)
    .sort((a, b) => {
      const pa = parciaisDaRodada ? scores.get(Number(a.id)) : undefined;
      const pb = parciaisDaRodada ? scores.get(Number(b.id)) : undefined;
      if (pa && !pb) return -1;
      if (!pa && pb) return 1;
      if (pa && pb) return pb.pontos - pa.pontos;
      return Number(b.media ?? 0) - Number(a.media ?? 0);
    });

  const equipe = (clube: Clube) => (
    <div className="flex min-w-0 items-center gap-2">
      {clube.escudo && <img src={clube.escudo} alt="" className="h-10 w-10 object-contain shrink-0" />}
      <div className="min-w-0">
        <div className="font-black truncate">{clube.sigla}</div>
        <div className="text-xs text-muted-foreground truncate">{clube.nome}</div>
      </div>
    </div>
  );

  const atletasEmCampo = (clube: Clube) => {
    const lista = atletasDoClube(clube.id);
    return (
      <section className="space-y-2">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          {clube.escudo && <img src={clube.escudo} alt="" className="h-6 w-6 object-contain" />}
          <h3 className="font-bold">{clube.nome}</h3>
          <Badge variant="outline" className="ml-auto">{lista.length} atletas</Badge>
        </div>
        {lista.length === 0 && (
          <p className="text-sm text-muted-foreground">Atletas deste clube ainda não estão disponíveis na sincronização do Neon.</p>
        )}
        {lista.map((atleta) => {
          const parcial = parciaisDaRodada ? scores.get(Number(atleta.id)) : undefined;
          return (
            <div key={atleta.id} className="flex gap-3 items-center rounded-md border border-border/50 bg-secondary/20 p-2">
              {atleta.foto_url ? (
                <img src={atleta.foto_url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-full object-cover bg-secondary" />
              ) : <span className="h-10 w-10 shrink-0 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                {POSICOES[Number(atleta.posicao_id)] || "AT"}
              </span>}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{atleta.apelido}</p>
                <p className="text-xs text-muted-foreground">
                  {POSICOES[Number(atleta.posicao_id)] || "—"}
                  {atleta.media != null ? " · Média " + fmt(Number(atleta.media)) : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={parcial ? "text-lg font-black " + (parcial.pontos >= 0 ? "text-neon-green" : "text-neon-red") : "text-lg text-muted-foreground"}>
                  {parcial ? fmt(parcial.pontos) : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">{parcial ? "Pontos na rodada" : "Sem parcial"}</p>
              </div>
            </div>
          );
        })}
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b-2 border-border">
        <div className="container mx-auto px-4 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-3 items-center">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Voltar ao painel">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-black text-2xl text-neon-cyan flex items-center gap-2"><Swords /> CONFRONTOS</h1>
              <p className="text-xs text-muted-foreground">
                {rodada ? "Brasileirão " + rodada.temporada + " · Rodada " + rodada.rodada : "Jogos do Brasileirão"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="flex gap-1"><Radio className="h-3 w-3" /> Atualização a cada 20s</Badge>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()} disabled={refreshing}>
              <RefreshCw className={"mr-2 h-4 w-4 " + (refreshing ? "animate-spin" : "")} /> Atualizar agora
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {error && <div role="alert" className="rounded border border-destructive/60 bg-destructive/10 p-3 text-sm">
          {error}{rodada ? " Exibindo a última atualização recebida." : ""}
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Placar: Cartola FC oficial. Pontuação dos atletas: parciais oficiais quando disponíveis.</span>
          <span>{rodada?.atualizadoEm ? "Placar consultado: " + new Date(rodada.atualizadoEm).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Aguardando atualização"}</span>
        </div>
        {loading && !rodada ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><RefreshCw className="h-5 w-5 animate-spin" /> Carregando partidas...</div>
        ) : !rodada?.jogos?.length ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum jogo oficial disponível. Use “Atualizar agora” para consultar novamente.</CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rodada.jogos.map((jogo) => {
              const live = aoVivo(jogo);
              const golsDisponiveis = jogo.placarCasa != null && jogo.placarFora != null;
              return <button key={jogo.id} type="button" className="text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setSelectedId(jogo.id)}>
                <Card className="h-full border-2 border-border hover:border-primary/70 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-center gap-2 mb-4">
                      <span className="text-xs text-muted-foreground flex gap-1 items-center"><Clock3 className="h-3.5 w-3.5" /> {dateTime(jogo.partidaEm)}</span>
                      {live ? <Badge className="bg-neon-red/20 text-neon-red border-neon-red/50">AO VIVO</Badge> :
                        <Badge variant="outline">{jogo.status || "Agendado"}</Badge>}
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      {equipe(jogo.casa)}
                      <div className="text-center">
                        <p className="font-black text-2xl whitespace-nowrap tabular-nums">
                          {golsDisponiveis ? String(jogo.placarCasa) + " × " + String(jogo.placarFora) : "×"}
                        </p>
                        {!golsDisponiveis && <span className="text-[10px] text-muted-foreground">Sem placar</span>}
                      </div>
                      <div className="justify-self-end">{equipe(jogo.fora)}</div>
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-1 text-sm text-primary font-semibold">
                      <Users className="h-4 w-4" /> Ver pontuação dos atletas <ChevronRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </button>;
            })}
          </div>
        )}
      </main>

      <Sheet open={selectedId !== null} onOpenChange={(isOpen) => { if (!isOpen) setSelectedId(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {partida && <>
            <SheetHeader>
              <SheetTitle>Pontuação dos atletas · Rodada {rodada?.rodada}</SheetTitle>
            </SheetHeader>
            <div className="mt-5 space-y-6">
              <div className="bg-secondary/30 rounded-lg p-4 text-center">
                <div className="font-bold">{partida.casa.sigla} <span className="text-2xl mx-3">
                  {partida.placarCasa != null && partida.placarFora != null ? String(partida.placarCasa) + " × " + String(partida.placarFora) : "×"}
                </span> {partida.fora.sigla}</div>
                <p className="text-xs text-muted-foreground mt-1">{dateTime(partida.partidaEm)} · {partida.status || "Agendado"}</p>
              </div>
              <div className="rounded border border-border p-3 text-xs text-muted-foreground">
                {parciaisDaRodada ? "Parciais conectadas à rodada " + rodada?.rodada + ". Atualização automática a cada 25s." :
                  "Parciais ainda não disponíveis para esta rodada. Valores não recebidos aparecem como —."}
                {parciaisDaRodada && parciaisAtualizadas && <span className="block mt-1">
                  Última consulta: {new Date(parciaisAtualizadas).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </span>}
              </div>
              {atletasEmCampo(partida.casa)}
              {atletasEmCampo(partida.fora)}
            </div>
          </>}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Confrontos;

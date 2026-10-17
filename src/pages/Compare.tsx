import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRightLeft, Search, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useLiveScores } from "@/hooks/useLiveScores";

type Atleta = {
  id: number; apelido: string; nome: string | null; clube_id: number | null;
  posicao_id: number | null; preco: number | null; media: number | null;
  jogos: number | null; pontos_num: number | null; foto_url: string | null; status_id: number | null;
};
type Clube = { id: number; nome: string; abreviacao: string; escudo_url: string | null };
type Slot = "A" | "B";
const POSICOES: Record<number, string> = { 1: "GOL", 2: "LAT", 3: "ZAG", 4: "MEI", 5: "ATA", 6: "TEC" };
const numero = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const buscaNormalizada = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function LinhaComparacao({ nome, a, b, formatar = numero, menorMelhor = false }:
  { nome: string; a: number | null; b: number | null; formatar?: (n: number) => string; menorMelhor?: boolean }) {
  const aMelhor = a != null && b != null && a !== b && (menorMelhor ? a < b : a > b);
  const bMelhor = a != null && b != null && a !== b && (menorMelhor ? b < a : b > a);
  return (
    <div className="border-b border-border py-3">
      <p className="text-center text-xs text-muted-foreground uppercase font-semibold mb-2">{nome}</p>
      <div className="grid grid-cols-[1fr_24px_1fr] gap-2 items-center">
        <span className={"text-right font-bold text-xl " + (aMelhor ? "text-neon-green" : "")}>{a == null ? "—" : formatar(a)}</span>
        <Zap className="w-4 h-4 mx-auto text-muted-foreground" />
        <span className={"text-left font-bold text-xl " + (bMelhor ? "text-neon-green" : "")}>{b == null ? "—" : formatar(b)}</span>
      </div>
    </div>
  );
}

export default function Compare() {
  const navigate = useNavigate();
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [clubes, setClubes] = useState<Record<number, Clube>>({});
  const [aId, setAId] = useState<number | null>(null);
  const [bId, setBId] = useState<number | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [pesquisa, setPesquisa] = useState("");
  const [posicao, setPosicao] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { scores, rodada, online } = useLiveScores();

  useEffect(() => {
    let active = true;
    async function carregar() {
      setLoading(true);
      try {
        const [atletasResp, clubesResp] = await Promise.all([
          supabase.from("atletas").select("id,apelido,nome,clube_id,posicao_id,preco,media,jogos,pontos_num,foto_url,status_id").limit(4000),
          supabase.from("clubes").select("id,nome,abreviacao,escudo_url").limit(100)
        ]);
        if (atletasResp.error) throw new Error(atletasResp.error.message || "Atletas indisponíveis");
        if (clubesResp.error) throw new Error(clubesResp.error.message || "Clubes indisponíveis");
        if (!active) return;
        setAtletas((atletasResp.data || []).filter((a: Atleta) => Number.isSafeInteger(Number(a.id))));
        const map: Record<number, Clube> = {};
        (clubesResp.data || []).forEach((c: Clube) => { map[c.id] = c; });
        setClubes(map);
        setError("");
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Falha ao consultar os atletas.");
      } finally { if (active) setLoading(false); }
    }
    void carregar();
    return () => { active = false; };
  }, []);

  const a = atletas.find((player) => player.id === aId) ?? null;
  const b = atletas.find((player) => player.id === bId) ?? null;
  const filtrados = useMemo(() => atletas
    .filter((player) => !posicao || String(player.posicao_id) === posicao)
    .filter((player) => {
      const clube = clubes[Number(player.clube_id)];
      const nome = (player.apelido || "") + " " + (player.nome || "") + " " +
        (clube?.nome || "") + " " + (clube?.abreviacao || "");
      return buscaNormalizada(nome).includes(buscaNormalizada(pesquisa));
    })
    .sort((x, y) => Number(y.media ?? 0) - Number(x.media ?? 0))
    .slice(0, 100), [atletas, clubes, pesquisa, posicao]);

  const escolher = (atleta: Atleta) => {
    if (slot === "A" && atleta.id === bId) return;
    if (slot === "B" && atleta.id === aId) return;
    if (slot === "A") setAId(atleta.id);
    if (slot === "B") setBId(atleta.id);
    setSlot(null);
    setPesquisa("");
    setPosicao("");
  };
  const abrirSeletor = (lado: Slot) => {
    setPesquisa(""); setPosicao(""); setSlot(lado);
  };

  const cartão = (atleta: Atleta | null, lado: Slot) => {
    const clube = atleta ? clubes[Number(atleta.clube_id)] : null;
    return (
      <Card className={"border-2 h-full " + (lado === "A" ? "border-primary/70" : "border-destructive/70")}>
        <CardContent className="p-5 text-center space-y-3">
          {atleta?.foto_url ? <img src={atleta.foto_url} alt="" className="w-24 h-24 rounded-full mx-auto object-cover bg-secondary" /> :
            <div className="w-24 h-24 rounded-full mx-auto bg-secondary flex items-center justify-center font-black text-4xl text-muted-foreground">{lado}</div>}
          <h2 className="font-black text-xl">{atleta?.apelido || "Nenhum atleta selecionado"}</h2>
          <p className="text-sm text-muted-foreground">{atleta ?
            (POSICOES[Number(atleta.posicao_id)] || "—") + " · " + (clube?.abreviacao || "—") : "Escolha um jogador real do Cartola"}</p>
          {atleta && <>
            <p className="text-3xl font-black text-neon-green">{atleta.media != null ? numero(Number(atleta.media)) : "—"}</p>
            <p className="text-xs text-muted-foreground uppercase">Média geral por jogo</p>
          </>}
          <Button variant="outline" onClick={() => abrirSeletor(lado)} className="w-full border-primary/60">
            {atleta ? <ArrowRightLeft className="h-4 w-4 mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            {atleta ? "Trocar atleta " + lado : "Selecionar atleta " + lado}
          </Button>
        </CardContent>
      </Card>
    );
  };

  const parcial = (player: Atleta | null) => player && online ? scores.get(player.id)?.pontos ?? null : null;
  const custoPorPonto = (player: Atleta | null) => {
    if (!player || !Number(player.media) || !Number(player.preco)) return null;
    return Number(player.media) / Number(player.preco);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3 items-center">
            <Button variant="ghost" size="icon" aria-label="Voltar ao painel" onClick={() => navigate("/dashboard")}>
              <ArrowLeft />
            </Button>
            <div>
              <h1 className="text-2xl font-black text-neon-cyan uppercase">Comparar atletas</h1>
              <p className="text-xs text-muted-foreground">Dados reais sincronizados com o Neon e Cartola FC</p>
            </div>
          </div>
          <Badge variant="outline" className="flex gap-1"><Users className="h-3.5 w-3.5" /> Dois atletas</Badge>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 space-y-6">
        {error && <div role="alert" className="p-3 border border-destructive/50 rounded bg-destructive/10 text-sm">{error}</div>}
        {loading ? <p className="text-muted-foreground py-12 text-center">Carregando atletas...</p> : <>
          {atletas.length === 0 && <p className="text-muted-foreground">Nenhum atleta encontrado. Sincronize os dados oficiais pelo painel de administração.</p>}
          <div className="grid gap-4 md:grid-cols-[1fr_1.2fr_1fr]">
            {cartão(a, "A")}
            <Card className="bg-card">
              <CardContent className="p-5">
                <h3 className="font-bold text-center uppercase tracking-wider text-sm text-neon-cyan mb-2">Comparativo</h3>
                {!a || !b ? (
                  <div className="text-center text-muted-foreground py-10">
                    Selecione um atleta em cada lado para comparar preços e desempenho.
                  </div>
                ) : <>
                  <LinhaComparacao nome="Média geral" a={a.media == null ? null : Number(a.media)} b={b.media == null ? null : Number(b.media)} />
                  <LinhaComparacao nome="Preço em cartoletas" a={a.preco == null ? null : Number(a.preco)} b={b.preco == null ? null : Number(b.preco)}
                    formatar={(n) => "C$ " + n.toFixed(2)} menorMelhor />
                  <LinhaComparacao nome="Jogos disputados" a={Number(a.jogos ?? 0)} b={Number(b.jogos ?? 0)} formatar={(n) => String(n)} />
                  <LinhaComparacao nome="Pontos acumulados" a={a.pontos_num == null ? null : Number(a.pontos_num)}
                    b={b.pontos_num == null ? null : Number(b.pontos_num)} />
                  <LinhaComparacao nome="Média por cartoleta" a={custoPorPonto(a)} b={custoPorPonto(b)} formatar={(n) => n.toFixed(2)} />
                  <LinhaComparacao nome={"Parcial da rodada " + (rodada ?? "atual")}
                    a={parcial(a)} b={parcial(b)} />
                </>}
              </CardContent>
            </Card>
            {cartão(b, "B")}
          </div>
          {a && b && <Card className="border-primary/40">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Dados históricos e desempenho real, sem probabilidades inventadas.
              {a.posicao_id !== b.posicao_id && " Os atletas são de posições diferentes; compare considerando suas funções."}
              {!online && " Pontuações parciais não estão disponíveis no momento."}
            </CardContent>
          </Card>}
        </>}
      </main>
      <Dialog open={slot !== null} onOpenChange={(opened) => { if (!opened) setSlot(null); }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Selecionar atleta {slot}</DialogTitle></DialogHeader>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input autoFocus placeholder="Buscar por atleta ou clube" value={pesquisa}
                onChange={(e) => setPesquisa(e.target.value)} className="pl-9" />
            </div>
            <select aria-label="Filtrar posição" value={posicao} onChange={(e) => setPosicao(e.target.value)}
              className="rounded-md border border-input bg-background px-3 h-10 text-sm">
              <option value="">Todas as posições</option>
              {Object.entries(POSICOES).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">Até 100 resultados. Digite parte do nome para refinar.</p>
          <div className="overflow-y-auto min-h-0 flex-1 space-y-1">
            {filtrados.length === 0 && <p className="text-sm text-muted-foreground p-4">Nenhum atleta corresponde à busca.</p>}
            {filtrados.map((atleta) => {
              const clube = clubes[Number(atleta.clube_id)];
              const bloqueado = slot === "A" ? atleta.id === bId : atleta.id === aId;
              return <button key={atleta.id} type="button" disabled={bloqueado} onClick={() => escolher(atleta)}
                className="w-full flex items-center gap-3 rounded-md p-3 text-left hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 disabled:cursor-not-allowed">
                {atleta.foto_url ? <img src={atleta.foto_url} alt="" loading="lazy" className="h-10 w-10 rounded-full bg-secondary object-cover" /> :
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-xs">AT</div>}
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{atleta.apelido}</p>
                  <p className="text-xs text-muted-foreground">{POSICOES[Number(atleta.posicao_id)] || "—"} · {clube?.abreviacao || "—"}</p>
                </div>
                <div className="text-right text-xs shrink-0">
                  <p className="font-semibold">C$ {Number(atleta.preco ?? 0).toFixed(2)}</p>
                  <p className="text-muted-foreground">Média {numero(Number(atleta.media ?? 0))}</p>
                </div>
                {bloqueado && <Badge variant="outline">Selecionado</Badge>}
              </button>;
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

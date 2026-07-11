import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper, ExternalLink, RefreshCw, Search, X, Users, Shield, CalendarClock, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  image: string | null;
  source: string;
}

interface NewsCardsProps {
  limit?: number;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  /** Intervalo de atualização automática em minutos. 0 desativa. Padrão: 5min. */
  refreshMinutes?: number;
}

const formatDate = (s: string) => {
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const NewsCards = ({
  limit = 6,
  title = "Tá Rolando no Brasileirão",
  subtitle = "Últimas das partidas e do mercado. Fica ligado pra não perder mitada.",
  compact = false,
  refreshMinutes = 5,
}: NewsCardsProps) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [filter, setFilter] = useState<"all" | "jogadores" | "times" | "proximos">("all");
  const [query, setQuery] = useState("");
  const [clubeNames, setClubeNames] = useState<string[]>([]);
  const [atletaNames, setAtletaNames] = useState<string[]>([]);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = async ({ silent = false, force = false }: { silent?: boolean; force?: boolean } = {}) => {
    // Evita chamadas concorrentes (aba volta ao foco durante refresh, por ex.)
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) setRefreshing(true);

    try {
      // Refresh manual força bypass do TTL (?refresh=1 no edge function)
      const invocation = force
        ? fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/news-brasileirao?refresh=1`,
            {
              method: "POST",
              headers: {
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
            },
          ).then((r) => r.json()).then((d) => ({ data: d, error: null }))
        : supabase.functions.invoke("news-brasileirao");

      const aborted = new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
      const { data } = (await Promise.race([invocation, aborted])) as any;
      if (controller.signal.aborted) return;
      if (data?.news) {
        setNews(data.news.slice(0, limit));
        setLastUpdate(Date.now());
        setStale(!!data.stale);
      }
    } catch (e) {
      if ((e as Error)?.message !== "aborted") {
        console.error("Erro ao carregar notícias", e);
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Carga inicial
  useEffect(() => {
    load({ silent: true });
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  // Polling automático — pausa quando a aba está oculta e retoma no foco
  useEffect(() => {
    if (!refreshMinutes || refreshMinutes <= 0) return;
    const intervalMs = refreshMinutes * 60_000;
    let timer: number | undefined;

    const tick = () => {
      if (document.visibilityState === "visible") {
        load({ silent: true });
      }
    };
    const start = () => {
      stop();
      timer = window.setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Se ficou oculto por mais que o intervalo, atualiza já
        if (!lastUpdate || Date.now() - lastUpdate > intervalMs) {
          load({ silent: true });
        }
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMinutes, limit]);

  const handleRefresh = () => {
    // Clique manual força bypass do cache no backend
    load({ silent: false, force: true });
  };

  const formatRelative = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return "agora";
    if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
    return `há ${Math.floor(diff / 3600)}h`;
  };

  // Dicionário de clubes/atletas para categorizar notícias
  useEffect(() => {
    (async () => {
      const [clubesRes, atletasRes] = await Promise.all([
        supabase.from("clubes").select("nome, abreviacao"),
        supabase.from("atletas").select("apelido").order("media", { ascending: false }).limit(250),
      ]);
      const clubes = (clubesRes.data || [])
        .flatMap((c: any) => [c.nome, c.abreviacao])
        .filter((v: string) => v && v.length >= 3);
      const atletas = (atletasRes.data || [])
        .map((a: any) => a.apelido)
        .filter((v: string) => v && v.length >= 3);
      setClubeNames(Array.from(new Set(clubes)));
      setAtletaNames(Array.from(new Set(atletas)));
    })();
  }, []);

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  // Palavras que indicam "próximo jogo / preview"
  const PROXIMOS_KEYWORDS = useMemo(
    () => [
      "provavel", "escalacao", "escalado", "escala", "escalará",
      "vai enfrentar", "encara", "recebe", "visita",
      "duelo", "confronto", "classico",
      "proximo jogo", "proxima rodada", "antes do jogo", "pre-jogo",
      "onde assistir", "que horas", "escala time",
    ],
    []
  );

  const categorize = (n: NewsItem) => {
    const text = normalize(`${n.title} ${n.description}`);
    const hasClube = clubeNames.some((c) => text.includes(normalize(c)));
    const hasAtleta = atletaNames.some((a) => text.includes(normalize(a)));
    const isProximo = PROXIMOS_KEYWORDS.some((k) => text.includes(k));
    return { hasClube, hasAtleta, isProximo };
  };

  const filteredNews = useMemo(() => {
    const q = normalize(query.trim());
    return news.filter((n) => {
      // busca livre
      if (q) {
        const text = normalize(`${n.title} ${n.description}`);
        if (!text.includes(q)) return false;
      }
      if (filter === "all") return true;
      const { hasClube, hasAtleta, isProximo } = categorize(n);
      if (filter === "jogadores") return hasAtleta;
      if (filter === "times") return hasClube;
      if (filter === "proximos") return isProximo || (hasClube && /\d{1,2}[hx:]\d{2}|hoje|amanha|domingo|sabado|sexta|quinta|quarta/i.test(normalize(n.title + " " + n.description)));
      return true;
    });
  }, [news, filter, query, clubeNames, atletaNames, PROXIMOS_KEYWORDS]);

  const counts = useMemo(() => {
    const c = { all: news.length, jogadores: 0, times: 0, proximos: 0 };
    for (const n of news) {
      const { hasClube, hasAtleta, isProximo } = categorize(n);
      if (hasAtleta) c.jogadores++;
      if (hasClube) c.times++;
      if (isProximo || hasClube) {
        if (isProximo) c.proximos++;
      }
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [news, clubeNames, atletaNames]);

  const FILTERS: { key: typeof filter; label: string; icon: any; count: number }[] = [
    { key: "all",       label: "Tudo",           icon: Globe2,        count: counts.all },
    { key: "jogadores", label: "Jogadores",      icon: Users,         count: counts.jogadores },
    { key: "times",     label: "Times",          icon: Shield,        count: counts.times },
    { key: "proximos",  label: "Próximos jogos", icon: CalendarClock, count: counts.proximos },
  ];

  const gridClass = compact
    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    : "grid md:grid-cols-2 lg:grid-cols-3 gap-6";


  return (
    <section className="w-full">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Newspaper className="h-6 w-6 md:h-7 md:w-7 text-neon-cyan" />
          <div>
            <h2 className="text-neon-cyan font-black uppercase text-xl md:text-2xl tracking-wider">
              {title}
            </h2>
            {subtitle && (
              <p className="text-muted-foreground text-sm">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {stale && (
            <span className="text-xs bg-warning/20 text-warning border border-warning/40 px-2 py-0.5 rounded font-bold uppercase" title="Fontes indisponíveis — exibindo última versão em cache">
              Cache
            </span>
          )}
          {lastUpdate && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Atualizado {formatRelative(lastUpdate)}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="border-border"
            title={refreshMinutes > 0 ? `Auto-atualização a cada ${refreshMinutes}min` : "Atualizar"}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className={gridClass}>
          {[...Array(limit)].map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-lg h-64 animate-pulse"
            />
          ))}
        </div>
      ) : news.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
          Nenhuma notícia disponível no momento.
        </div>
      ) : (
        <div className={gridClass}>
          {news.map((n, i) => (
            <a
              key={i}
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-card border-2 border-border rounded-lg overflow-hidden hover:border-primary hover:shadow-neon transition-all duration-300 flex flex-col"
            >
              {n.image ? (
                <div className="aspect-video w-full overflow-hidden bg-secondary">
                  <img
                    src={n.image}
                    alt={n.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ) : (
                <div className="aspect-video w-full bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center">
                  <Newspaper className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span className="bg-primary/10 text-neon-cyan px-2 py-0.5 rounded font-bold uppercase">
                    {n.source}
                  </span>
                  <span>{formatDate(n.pubDate)}</span>
                </div>
                <h3 className="font-bold text-foreground text-sm md:text-base leading-snug mb-2 group-hover:text-neon-cyan transition-colors line-clamp-3">
                  {n.title}
                </h3>
                {n.description && !compact && (
                  <p className="text-muted-foreground text-sm line-clamp-3 flex-1">
                    {n.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-1 text-xs text-neon-cyan font-bold uppercase">
                  Ler matéria <ExternalLink className="h-3 w-3" />
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
};

export default NewsCards;

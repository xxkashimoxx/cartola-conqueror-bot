import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LiveScore {
  pontos: number;
  jogou: boolean;
  scout: Record<string, number> | null;
  atualizado_em: string;
  prev?: number;         // pontuação anterior (para animar delta)
  changedAt?: number;    // timestamp local da última mudança
}

export interface UseLiveScoresResult {
  scores: Map<number, LiveScore>;
  rodada: number | null;
  online: boolean;
  lastUpdate: number | null;
}

/**
 * Assina em tempo real a tabela `atleta_parciais` e devolve um mapa
 * atleta_id -> pontuação ao vivo, com o valor anterior para animar delta.
 */
export function useLiveScores(): UseLiveScoresResult {
  const [scores, setScores] = useState<Map<number, LiveScore>>(new Map());
  const [rodada, setRodada] = useState<number | null>(null);
  const [online, setOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const scoresRef = useRef(scores);
  scoresRef.current = scores;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1) descobrir rodada atual
      const { data: merc } = await supabase
        .from("mercado_status")
        .select("rodada_atual")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const rd = (merc as any)?.rodada_atual ?? null;
      if (cancelled) return;
      setRodada(rd);
      if (!rd) return;

      // 2) snapshot inicial
      const { data: parciais } = await supabase
        .from("atleta_parciais")
        .select("atleta_id, pontos, scout, jogou, atualizado_em")
        .eq("rodada", rd);
      if (cancelled) return;
      const map = new Map<number, LiveScore>();
      (parciais || []).forEach((r: any) => {
        map.set(r.atleta_id, {
          pontos: Number(r.pontos) || 0,
          jogou: !!r.jogou,
          scout: r.scout,
          atualizado_em: r.atualizado_em,
        });
      });
      setScores(map);
      if (parciais && parciais.length > 0) setLastUpdate(Date.now());
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!rodada) return;

    const channel = supabase
      .channel(`atleta_parciais_r${rodada}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "atleta_parciais",
          filter: `rodada=eq.${rodada}`,
        },
        (payload) => {
          const row: any = payload.new || payload.old;
          if (!row) return;
          const atletaId = Number(row.atleta_id);
          setScores((prevMap) => {
            const next = new Map(prevMap);
            const previous = next.get(atletaId);
            const pontos = Number(row.pontos) || 0;
            next.set(atletaId, {
              pontos,
              jogou: !!row.jogou,
              scout: row.scout,
              atualizado_em: row.atualizado_em,
              prev: previous?.pontos,
              changedAt:
                previous && previous.pontos !== pontos ? Date.now() : previous?.changedAt,
            });
            return next;
          });
          setLastUpdate(Date.now());
        },
      )
      .subscribe((status) => {
        setOnline(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rodada]);

  return { scores, rodada, online, lastUpdate };
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LiveScore {
  pontos: number;
  jogou: boolean;
  scout: Record<string, number> | null;
  atualizado_em: string;
  prev?: number;
  changedAt?: number;
}
export interface UseLiveScoresResult {
  scores: Map<number, LiveScore>;
  rodada: number | null;
  online: boolean;
  lastUpdate: number | null;
}

/**
 * Neon Data API has no Supabase Realtime subscription.
 * Poll every 15 seconds while the tab is visible; preserve previous values for animations.
 */
export function useLiveScores(): UseLiveScoresResult {
  const [scores, setScores] = useState<Map<number, LiveScore>>(new Map());
  const [rodada, setRodada] = useState<number | null>(null);
  const [online, setOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    let busy = false;
    async function update() {
      if (!mounted || busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const { data: merc, error: mercErr } = await supabase
          .from("mercado_status").select("rodada_atual")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (mercErr) throw mercErr;
        const round = (merc as { rodada_atual?: number } | null)?.rodada_atual ?? null;
        if (!mounted) return;
        setRodada(round);
        if (!round) { setOnline(true); return; }
        const { data: entries, error } = await supabase
          .from("atleta_parciais")
          .select("atleta_id,pontos,scout,jogou,atualizado_em")
          .eq("rodada", round);
        if (error) throw error;
        if (!mounted) return;
        setScores((previous) => {
          const next = new Map<number, LiveScore>();
          for (const row of entries || []) {
            const old = previous.get(Number(row.atleta_id));
            const points = Number(row.pontos) || 0;
            next.set(Number(row.atleta_id), {
              pontos: points,
              jogou: Boolean(row.jogou),
              scout: row.scout,
              atualizado_em: row.atualizado_em,
              prev: old?.pontos,
              changedAt: old && old.pontos !== points ? Date.now() : old?.changedAt,
            });
          }
          return next;
        });
        setOnline(true);
        if ((entries || []).length) setLastUpdate(Date.now());
      } catch (error) {
        console.error("Neon: erro ao atualizar parciais", error);
        if (mounted) setOnline(false);
      } finally {
        busy = false;
      }
    }
    void update();
    const interval = window.setInterval(update, 15000);
    document.addEventListener("visibilitychange", update);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return { scores, rodada, online, lastUpdate };
}

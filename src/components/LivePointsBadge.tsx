import { useEffect, useState } from "react";
import { LiveScore } from "@/hooks/useLiveScores";
import { Radio, TrendingUp, TrendingDown } from "lucide-react";

interface LivePointsBadgeProps {
  live?: LiveScore;
  fallback?: number;
}

/**
 * Badge que mostra os pontos ao vivo do jogador durante a partida.
 * - Pisca em verde quando ganhou pontos
 * - Pisca em vermelho quando perdeu pontos
 * - Mostra "AO VIVO" quando o jogador está em campo
 */
const LivePointsBadge = ({ live, fallback }: LivePointsBadgeProps) => {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (!live || live.prev === undefined || live.prev === live.pontos) return;
    setFlash(live.pontos > live.prev ? "up" : "down");
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [live?.pontos, live?.changedAt]);

  if (!live) {
    // Sem parcial ainda — mostra placeholder discreto se tiver fallback
    if (fallback === undefined) return null;
    return (
      <div className="flex justify-between items-center bg-secondary/20 p-2 rounded-lg border border-border/40">
        <span className="text-muted-foreground text-xs font-medium flex items-center gap-1">
          <Radio className="h-3 w-3" />
          Aguardando entrada em campo
        </span>
        <span className="text-muted-foreground text-sm">—</span>
      </div>
    );
  }

  const delta = live.prev !== undefined ? live.pontos - live.prev : 0;
  const positive = live.pontos >= 0;

  const bgClass =
    flash === "up"
      ? "bg-neon-green/20 border-neon-green animate-pulse"
      : flash === "down"
      ? "bg-neon-red/20 border-neon-red animate-pulse"
      : live.jogou
      ? "bg-neon-red/10 border-neon-red/40"
      : "bg-secondary/30 border-border/40";

  return (
    <div className={`flex justify-between items-center p-2 rounded-lg border ${bgClass} transition-colors`}>
      <span className="text-xs font-medium flex items-center gap-1.5">
        {live.jogou ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-red opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-red" />
            </span>
            <span className="text-neon-red font-bold uppercase tracking-wider">AO VIVO</span>
          </>
        ) : (
          <>
            <Radio className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Parcial</span>
          </>
        )}
      </span>
      <div className="flex items-center gap-1.5">
        {flash && delta !== 0 && (
          <span
            className={`text-xs font-bold ${
              delta > 0 ? "text-neon-green" : "text-neon-red"
            }`}
          >
            {delta > 0 ? (
              <TrendingUp className="h-3 w-3 inline" />
            ) : (
              <TrendingDown className="h-3 w-3 inline" />
            )}{" "}
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}
          </span>
        )}
        <span
          className={`font-black text-lg ${
            positive ? "text-neon-green" : "text-neon-red"
          }`}
        >
          {live.pontos.toFixed(1)}
        </span>
      </div>
    </div>
  );
};

export default LivePointsBadge;

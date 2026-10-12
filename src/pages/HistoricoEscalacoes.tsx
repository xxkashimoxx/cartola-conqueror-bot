import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, History, Loader2, TrendingUp, TrendingDown, Crown, Lock, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface EscalacaoRow {
  rodada: number;
  tipo: "minha" | "recomendada";
  estrategia: string | null;
  atleta_ids: number[];
  reservas_ids?: number[];
  pontos_esperados: number | null;
  valor_total: number | null;
  updated_at: string;
  captain_id: number | null;
  score?: {total:number|null;status:string;source:string;coverage:number;captainBonus:number|null;
    players:{id:number;points:number}[];substitutions?:{outId:number;inId:number;captain:boolean}[]};
}

interface RodadaResumo {
  rodada: number;
  estrategia: string | null;
  minhaIds: number[];
  reservasIds: number[];
  substituicoes: {outId:number;inId:number;captain:boolean}[];
  recIds: number[];
  minhaEsperado: number;
  recEsperado: number;
  minhaReal: number | null;
  recReal: number | null;
  trocas: number;
  updated_at: string;
  currentStatus?: string|null;
  source?: string|null;
  captainMissing?: boolean;
}

const HistoricoEscalacoes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EscalacaoRow[]>([]);
  const [pontosPorRodada, setPontosPorRodada] = useState<Record<string, number>>({});
  const [atletasMap, setAtletasMap] = useState<Record<number, string>>({});

  useEffect(() => {
    if(!user)return;
    let active=true;
    const reload=async()=>{
      try{
        const res=await fetch("/api/lineups",{credentials:"same-origin",cache:"no-store"});
        if(!res.ok)throw Error("Sem acesso ao histórico");
        const data=await res.json();
        if(!active)return;
        const list=(data.rows||[]) as EscalacaoRow[];
        setRows(list);
        const points:Record<string,number>={};
        for(const r of list){
          for(const p of r.score?.players||[])points[p.id+"-"+r.rodada]=Number(p.points);
        }
        setPontosPorRodada(points);
        const ids=[...new Set(list.flatMap(r=>[...(r.atleta_ids||[]),...(r.reservas_ids||[])]))];
        if(ids.length){
          const {data:players}=await supabase.from("atletas").select("id,apelido").in("id",ids.slice(0,250));
          if(active){
            const names:Record<number,string>={};
            for(const p of players||[])names[p.id]=p.apelido;
            setAtletasMap(names);
          }
        }
      }catch(e){console.warn("Histórico temporariamente indisponível",e);}
      finally{if(active)setLoading(false);}
    };
    void reload();
    const poll=window.setInterval(()=>{if(document.visibilityState==="visible")void reload()},35000);
    return()=>{active=false;window.clearInterval(poll)};
  },[user?.id]);

  const resumos = useMemo<RodadaResumo[]>(() => {
    const byRodada = new Map<number, RodadaResumo>();
    for (const r of rows) {
      const existing = byRodada.get(r.rodada) ?? {
        rodada: r.rodada,
        estrategia: r.estrategia,
        minhaIds: [],
        reservasIds: [],
        substituicoes: [],
        recIds: [],
        minhaEsperado: 0,
        recEsperado: 0,
        minhaReal: null,
        recReal: null,
        trocas: 0,
        updated_at: r.updated_at,
        currentStatus: null,
        source: null,
        captainMissing: false,
      };
      if (r.tipo === "minha") {
        existing.minhaIds = r.atleta_ids ?? [];
        existing.reservasIds = r.reservas_ids ?? [];
        existing.substituicoes = r.score?.substitutions ?? [];
        existing.minhaEsperado = Number(r.pontos_esperados ?? 0);
        existing.minhaReal = r.score?.total ?? null;
        existing.currentStatus = r.score?.status || null;
        existing.source = r.score?.source || null;
        existing.captainMissing = r.captain_id==null;
      } else if (r.tipo === "recomendada") {
        existing.recIds = r.atleta_ids ?? [];
        existing.recEsperado = Number(r.pontos_esperados ?? 0);
        existing.recReal = r.score?.total ?? null;
      }
      existing.estrategia = existing.estrategia ?? r.estrategia;
      byRodada.set(r.rodada, existing);
    }

    const result: RodadaResumo[] = [];
    for (const r of byRodada.values()) {
      const recSet=new Set(r.recIds);
      const trocas=r.minhaIds.filter(id=>!recSet.has(id)).length;
      result.push({...r,trocas});
    }
    return result.sort((a, b) => a.rodada - b.rodada);
  }, [rows, pontosPorRodada]);

  const chartData = useMemo(
    () =>
      resumos.map((r) => ({
        rodada: `R${r.rodada}`,
        minha: r.minhaReal ?? r.minhaEsperado,
        recomendada: r.recReal ?? r.recEsperado,
        diff: Number(
          ((r.minhaReal ?? r.minhaEsperado) - (r.recReal ?? r.recEsperado)).toFixed(2)
        ),
      })),
    [resumos]
  );

  // Agregados
  const totals = useMemo(() => {
    let minhaReal = 0;
    let recReal = 0;
    let minhaEsp = 0;
    let recEsp = 0;
    let rodadasComReal = 0;
    let acertos = 0;
    resumos.forEach((r) => {
      minhaEsp += r.minhaEsperado;
      recEsp += r.recEsperado;
      if (r.minhaReal !== null && r.recReal !== null) {
        minhaReal += r.minhaReal;
        recReal += r.recReal;
        rodadasComReal++;
        if (r.minhaReal >= r.recReal) acertos++;
      }
    });
    return { minhaReal, recReal, minhaEsp, recEsp, rodadasComReal, acertos };
  }, [resumos]);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="border-border">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            <h1 className="text-2xl font-black text-neon-cyan uppercase tracking-wider flex items-center gap-2">
              <History className="h-6 w-6" /> Histórico de Escalações
            </h1>
          </div>
          <Button onClick={() => navigate("/team-builder")} className="bg-primary hover:bg-primary/80 font-bold">
            Montar nova
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : resumos.length === 0 ? (
          <Card className="p-10 text-center bg-card border-border">
            <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-bold text-foreground mb-1">Nenhuma escalação salva ainda</p>
            <p className="text-sm text-muted-foreground mb-4">
              Vai no Construtor de Time, monta e salva pra começar teu histórico.
            </p>
            <Button onClick={() => navigate("/team-builder")} className="bg-primary hover:bg-primary/80">
              Montar primeira escalação
            </Button>
          </Card>
        ) : (
          <>
            {/* Agregados */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Card className="bg-card border-border p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase">Rodadas salvas</p>
                <p className="text-2xl font-black text-foreground">{resumos.length}</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase">Pontos (eu)</p>
                <p className="text-2xl font-black text-neon-cyan">{totals.minhaReal.toFixed(1)}</p>
                <p className="text-[10px] text-muted-foreground">{totals.rodadasComReal} rodadas c/ dados</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase">Pontos (recom.)</p>
                <p className="text-2xl font-black text-neon-green">{totals.recReal.toFixed(1)}</p>
              </Card>
              <Card
                className={cn(
                  "border-2 p-4 text-center",
                  totals.minhaReal >= totals.recReal
                    ? "border-neon-green/50 bg-neon-green/5"
                    : "border-destructive/50 bg-destructive/5"
                )}
              >
                <p className="text-xs text-muted-foreground uppercase">Diferença acumulada</p>
                <p
                  className={cn(
                    "text-2xl font-black",
                    totals.minhaReal >= totals.recReal ? "text-neon-green" : "text-destructive"
                  )}
                >
                  {totals.minhaReal - totals.recReal >= 0 ? "+" : ""}
                  {(totals.minhaReal - totals.recReal).toFixed(1)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Mitou em {totals.acertos}/{totals.rodadasComReal}
                </p>
              </Card>
            </div>

            {/* Gráfico */}
            <Card className="bg-card border-2 border-primary/40 shadow-neon p-5 mb-6">
              <h2 className="font-black uppercase tracking-wider text-neon-cyan mb-4">
                Evolução por rodada
              </h2>
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="rodada" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <ReTooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="minha"
                      name="Minha"
                      stroke="hsl(var(--neon-cyan, 190 100% 50%))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="recomendada"
                      name="Recomendada"
                      stroke="hsl(var(--neon-green, 140 100% 50%))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Lista por rodada */}
            <div className="space-y-3">
              {resumos
                .slice()
                .reverse()
                .map((r) => {
                  const usaReal = r.minhaReal !== null && r.recReal !== null;
                  const minha = usaReal ? r.minhaReal! : r.minhaEsperado;
                  const rec = usaReal ? r.recReal! : r.recEsperado;
                  const diff = minha - rec;
                  return (
                    <Card key={r.rodada} className="bg-card border-border p-4">
                      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-sm font-black">
                            Rodada {r.rodada}
                          </Badge>
                          {r.estrategia && (
                            <Badge variant="outline" className="text-xs uppercase">
                              {r.estrategia}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] uppercase",
                              usaReal ? "border-neon-green/50 text-neon-green" : "border-muted text-muted-foreground"
                            )}
                          >
                            {usaReal ? (r.currentStatus==="encerrada"?"Pontuação oficial":"Parcial ao vivo") : "Projeção"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase">Minha</p>
                            <p className="text-lg font-black text-neon-cyan">{minha.toFixed(1)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase">Recom.</p>
                            <p className="text-lg font-black text-neon-green">{rec.toFixed(1)}</p>
                          </div>
                          <div className="text-right min-w-[70px]">
                            <p className="text-[10px] text-muted-foreground uppercase flex items-center justify-end gap-1">
                              Diff {diff >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            </p>
                            <p
                              className={cn(
                                "text-lg font-black",
                                diff >= 0 ? "text-neon-green" : "text-destructive"
                              )}
                            >
                              {diff >= 0 ? "+" : ""}
                              {diff.toFixed(1)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {r.source && <p className="text-xs text-muted-foreground mt-2">Fonte: {r.source} · Rodada {r.rodada}</p>}
                      {r.captainMissing && <p className="text-xs text-amber-500 mt-1">Capitão não registrado nesta escalação antiga: o total mostrado não contém o bônus de 50%. Selecione o capitão em Meu Time e salve.</p>}
                      {r.reservasIds.length>0&&<div className="pt-3 mt-3 border-t border-border">
                        <p className="text-[10px] font-black uppercase tracking-wider text-neon-cyan mb-2">Banco de reservas ({r.reservasIds.length}/5)</p>
                        <div className="flex flex-wrap gap-1">
                          {r.reservasIds.map(id=><Badge key={id} variant="outline" className="text-[10px]">
                            {atletasMap[id]??`#${id}`}{r.substituicoes.some(s=>s.inId===id)?" · entrou":""}
                          </Badge>)}
                        </div>
                        {r.substituicoes.map(s=><p key={s.outId} className="text-xs text-neon-green mt-2">
                          {atletasMap[s.outId]??`#${s.outId}`} → {atletasMap[s.inId]??`#${s.inId}`}{s.captain?" · capitão":""}
                        </p>)}
                      </div>}
                      {/* Detalhamento de trocas */}
                      {r.trocas > 0 && (
                        <div className="pt-3 border-t border-border">
                          <p className="text-[10px] font-black uppercase tracking-wider text-neon-cyan mb-2 flex items-center gap-1">
                            <Crown className="h-3 w-3" /> Trocas vs recomendada ({r.trocas})
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {r.minhaIds
                              .filter((id) => !new Set(r.recIds).has(id))
                              .map((id) => (
                                <Badge
                                  key={id}
                                  variant="outline"
                                  className="text-[10px] border-primary/50 text-foreground"
                                >
                                  {atletasMap[id] ?? `#${id}`}
                                  {pontosPorRodada[`${id}-${r.rodada}`] !== undefined && (
                                    <span className="ml-1 text-neon-green">
                                      ({pontosPorRodada[`${id}-${r.rodada}`].toFixed(1)})
                                    </span>
                                  )}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HistoricoEscalacoes;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  UserCheck, 
  TrendingUp, 
  Database,
  RefreshCw,
  AlertCircle,
  Star,
  Trophy
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface SyncAnalytics {
  id: string;
  sync_type: string;
  records_synced: number;
  success: boolean;
  error_message: string | null;
  synced_at: string;
}

interface Stats {
  totalPlayers: number;
  totalClubs: number;
  totalSyncs: number;
  successfulSyncs: number;
}

interface Atleta {
  id: number;
  apelido: string;
  media: number | null;
  pontos_num: number | null;
  preco: number | null;
  posicao_id: number | null;
  clube_id: number | null;
}

interface Posicao {
  id: number;
  nome: string;
  abreviacao: string;
}

interface PontuacaoRodada {
  rodada: number;
  pontos: number;
  atleta_id: number | null;
}

interface RodadaChartData {
  rodada: string;
  mediaPontos: number;
  totalPontos: number;
  jogadores: number;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const AdminDashboard = () => {
  const [syncHistory, setSyncHistory] = useState<SyncAnalytics[]>([]);
  const [topPlayers, setTopPlayers] = useState<Atleta[]>([]);
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [pontuacoesRodada, setPontuacoesRodada] = useState<RodadaChartData[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPlayers: 0,
    totalClubs: 0,
    totalSyncs: 0,
    successfulSyncs: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch sync history
      const { data: syncData } = await supabase
        .from("sync_analytics")
        .select("*")
        .order("synced_at", { ascending: false })
        .limit(20);

      if (syncData) {
        setSyncHistory(syncData);
      }

      // Fetch player count
      const { count: playerCount } = await supabase
        .from("atletas")
        .select("*", { count: "exact", head: true });

      // Fetch club count
      const { count: clubCount } = await supabase
        .from("clubes")
        .select("*", { count: "exact", head: true });

      // Fetch top players by average
      const { data: playersData } = await supabase
        .from("atletas")
        .select("id, apelido, media, pontos_num, preco, posicao_id, clube_id")
        .order("media", { ascending: false })
        .limit(10);

      if (playersData) {
        setTopPlayers(playersData);
      }

      // Fetch positions
      const { data: posicoesData } = await supabase
        .from("posicoes")
        .select("*");

      if (posicoesData) {
        setPosicoes(posicoesData);
      }

      // Fetch pontuações por rodada
      const { data: pontuacoesData } = await supabase
        .from("atleta_pontuacoes")
        .select("rodada, pontos, atleta_id")
        .order("rodada", { ascending: true });

      if (pontuacoesData && pontuacoesData.length > 0) {
        // Agrupa por rodada
        const rodadaMap = new Map<number, { total: number; count: number }>();
        pontuacoesData.forEach((p: PontuacaoRodada) => {
          const existing = rodadaMap.get(p.rodada) || { total: 0, count: 0 };
          rodadaMap.set(p.rodada, {
            total: existing.total + (p.pontos || 0),
            count: existing.count + 1,
          });
        });

        const chartData: RodadaChartData[] = Array.from(rodadaMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([rodada, data]) => ({
            rodada: `R${rodada}`,
            mediaPontos: data.count > 0 ? Number((data.total / data.count).toFixed(2)) : 0,
            totalPontos: Number(data.total.toFixed(2)),
            jogadores: data.count,
          }));

        setPontuacoesRodada(chartData);
      }

      // Calculate sync stats
      const totalSyncs = syncData?.length || 0;
      const successfulSyncs = syncData?.filter((s) => s.success).length || 0;

      setStats({
        totalPlayers: playerCount || 0,
        totalClubs: clubCount || 0,
        totalSyncs,
        successfulSyncs,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const syncChartData = syncHistory
    .slice(0, 10)
    .reverse()
    .map((sync) => ({
      date: new Date(sync.synced_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      records: sync.records_synced,
      type: sync.sync_type,
    }));

  const syncTypeData = syncHistory.reduce((acc, sync) => {
    const existing = acc.find((a) => a.type === sync.sync_type);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ type: sync.sync_type, count: 1 });
    }
    return acc;
  }, [] as { type: string; count: number }[]);

  // Top players chart data
  const topPlayersChartData = topPlayers.map((player) => ({
    name: player.apelido,
    media: player.media || 0,
    pontos: player.pontos_num || 0,
  }));

  // Players by position data
  const playersByPositionData = posicoes.map((pos) => {
    const count = topPlayers.filter((p) => p.posicao_id === pos.id).length;
    return {
      name: pos.abreviacao,
      fullName: pos.nome,
      value: count,
    };
  }).filter((p) => p.value > 0);

  // Price distribution data
  const priceRanges = [
    { range: "0-5", min: 0, max: 5 },
    { range: "5-10", min: 5, max: 10 },
    { range: "10-15", min: 10, max: 15 },
    { range: "15-20", min: 15, max: 20 },
    { range: "20+", min: 20, max: Infinity },
  ];

  const priceDistributionData = priceRanges.map((range) => ({
    range: range.range,
    count: topPlayers.filter(
      (p) => (p.preco || 0) >= range.min && (p.preco || 0) < range.max
    ).length,
  }));

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-neon-cyan">Analytics do Cartola</h1>
          <p className="text-muted-foreground">
            Estatísticas de sincronização e dados dos jogadores
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Jogadores
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stats.totalPlayers.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Clubes
              </CardTitle>
              <Database className="h-4 w-4 text-neon-green" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stats.totalClubs}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sincronizações
              </CardTitle>
              <RefreshCw className="h-4 w-4 text-neon-yellow" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stats.totalSyncs}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Taxa de Sucesso
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stats.totalSyncs > 0
                  ? Math.round((stats.successfulSyncs / stats.totalSyncs) * 100)
                  : 0}
                %
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Evolution by Round Chart */}
        {pontuacoesRodada.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Evolução de Pontuação por Rodada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pontuacoesRodada}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="rodada" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      yAxisId="left"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value: number, name: string) => {
                        const label = name === "mediaPontos" ? "Média" : name === "totalPontos" ? "Total" : "Jogadores";
                        return [value.toFixed(2), label];
                      }}
                    />
                    <Legend 
                      formatter={(value) => {
                        if (value === "mediaPontos") return "Média de Pontos";
                        if (value === "totalPontos") return "Total de Pontos";
                        return value;
                      }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="mediaPontos"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", r: 4 }}
                      activeDot={{ r: 6 }}
                      name="mediaPontos"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="totalPontos"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--chart-2))", r: 4 }}
                      activeDot={{ r: 6 }}
                      name="totalPontos"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Média de pontos (esquerda) e total de pontos (direita) por rodada
              </p>
            </CardContent>
          </Card>
        )}

        {/* Player Scoring Charts */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-neon-yellow" />
            Pontuação dos Jogadores
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Players by Average */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Star className="h-4 w-4 text-neon-yellow" />
                  Top 10 Jogadores por Média
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topPlayersChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        type="number" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        type="category"
                        dataKey="name" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        width={80}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        formatter={(value: number) => [value.toFixed(2), "Média"]}
                      />
                      <Bar 
                        dataKey="media" 
                        fill="hsl(var(--primary))" 
                        radius={[0, 4, 4, 0]}
                        name="Média"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top Players by Total Points */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-neon-green" />
                  Top 10 Jogadores por Pontos Totais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topPlayersChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        type="number" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        type="category"
                        dataKey="name" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        width={80}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        formatter={(value: number) => [value.toFixed(2), "Pontos"]}
                      />
                      <Bar 
                        dataKey="pontos" 
                        fill="hsl(var(--chart-2))" 
                        radius={[0, 4, 4, 0]}
                        name="Pontos"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Players by Position */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">
                  Top Jogadores por Posição
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={playersByPositionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="hsl(var(--primary))"
                        dataKey="value"
                      >
                        {playersByPositionData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={CHART_COLORS[index % CHART_COLORS.length]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number, name: string, props: any) => [
                          value, 
                          props.payload.fullName
                        ]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Price Distribution */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">
                  Distribuição de Preços (C$)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priceDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="range" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        formatter={(value: number) => [value, "Jogadores"]}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="hsl(var(--chart-3))" 
                        radius={[4, 4, 0, 0]}
                        name="Jogadores"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sync Charts */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Sincronização
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">
                  Registros Sincronizados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={syncChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "4px",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="records"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">
                  Sincronizações por Tipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={syncTypeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="type" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "4px",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Syncs */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">
              Histórico de Sincronizações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {syncHistory.slice(0, 10).map((sync) => (
                <div
                  key={sync.id}
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {sync.success ? (
                      <UserCheck className="h-5 w-5 text-success" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">
                        {sync.sync_type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {sync.records_synced} registros
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {new Date(sync.synced_at).toLocaleString("pt-BR")}
                    </p>
                    {sync.error_message && (
                      <p className="text-xs text-destructive">
                        {sync.error_message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {syncHistory.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma sincronização registrada ainda
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;

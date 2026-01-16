import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, 
  UserCheck, 
  TrendingUp, 
  Database,
  RefreshCw,
  AlertCircle,
  Star,
  Trophy,
  Filter,
  X
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

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  admins: number;
  newUsersThisMonth: number;
}

interface UserRegistrationData {
  date: string;
  count: number;
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
  [key: string]: string | number;
}

interface AtletaSimples {
  id: number;
  apelido: string;
}

interface PontuacaoRaw {
  rodada: number;
  pontos: number;
  atleta_id: number | null;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(280, 70%, 60%)",
  "hsl(200, 70%, 50%)",
  "hsl(340, 70%, 50%)",
  "hsl(160, 70%, 40%)",
  "hsl(30, 80%, 50%)",
];

const AdminDashboard = () => {
  const [syncHistory, setSyncHistory] = useState<SyncAnalytics[]>([]);
  const [topPlayers, setTopPlayers] = useState<Atleta[]>([]);
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [pontuacoesRodada, setPontuacoesRodada] = useState<RodadaChartData[]>([]);
  const [pontuacoesRaw, setPontuacoesRaw] = useState<PontuacaoRaw[]>([]);
  const [atletasDisponiveis, setAtletasDisponiveis] = useState<AtletaSimples[]>([]);
  const [selectedAtletas, setSelectedAtletas] = useState<number[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>({
    totalUsers: 0,
    activeUsers: 0,
    admins: 0,
    newUsersThisMonth: 0,
  });
  const [registrationData, setRegistrationData] = useState<UserRegistrationData[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPlayers: 0,
    totalClubs: 0,
    totalSyncs: 0,
    successfulSyncs: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
    fetchUserStats();
  }, []);

  const fetchUserStats = async () => {
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, is_active, created_at");

      if (profilesError) throw profilesError;

      // Fetch admin roles
      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (rolesError) throw rolesError;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const totalUsers = profiles?.length || 0;
      const activeUsers = profiles?.filter(p => p.is_active).length || 0;
      const admins = adminRoles?.length || 0;
      const newUsersThisMonth = profiles?.filter(p => 
        new Date(p.created_at) >= startOfMonth
      ).length || 0;

      setUserStats({
        totalUsers,
        activeUsers,
        admins,
        newUsersThisMonth,
      });

      // Generate registration data for the last 30 days
      const last30Days: UserRegistrationData[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = profiles?.filter(p => 
          p.created_at.split('T')[0] === dateStr
        ).length || 0;
        last30Days.push({
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          count,
        });
      }
      setRegistrationData(last30Days);
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }
  };

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
        setPontuacoesRaw(pontuacoesData);

        // Buscar atletas únicos que têm pontuações
        const atletaIds = [...new Set(pontuacoesData.map(p => p.atleta_id).filter(Boolean))] as number[];
        
        if (atletaIds.length > 0) {
          const { data: atletasData } = await supabase
            .from("atletas")
            .select("id, apelido")
            .in("id", atletaIds.slice(0, 100)) // Limita a 100 para performance
            .order("apelido", { ascending: true });

          if (atletasData) {
            setAtletasDisponiveis(atletasData);
          }
        }

        // Agrupa por rodada (dados gerais)
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
      (p) => (p.preco ?? 0) >= range.min && (p.preco ?? 0) < range.max
    ).length,
  }));

  // Dados do gráfico filtrado por jogadores selecionados
  const filteredChartData = useMemo(() => {
    if (selectedAtletas.length === 0) {
      return pontuacoesRodada;
    }

    // Agrupa por rodada para cada atleta selecionado
    const rodadaMap = new Map<number, RodadaChartData>();
    
    pontuacoesRaw.forEach((p) => {
      if (!selectedAtletas.includes(p.atleta_id as number)) return;
      
      const existing = rodadaMap.get(p.rodada) || {
        rodada: `R${p.rodada}`,
        mediaPontos: 0,
        totalPontos: 0,
        jogadores: 0,
      };
      
      existing.totalPontos += p.pontos || 0;
      existing.jogadores += 1;
      
      // Adiciona pontos individuais por atleta
      const atleta = atletasDisponiveis.find(a => a.id === p.atleta_id);
      if (atleta) {
        existing[`atleta_${p.atleta_id}`] = p.pontos || 0;
      }
      
      rodadaMap.set(p.rodada, existing);
    });

    return Array.from(rodadaMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([_, data]) => ({
        ...data,
        mediaPontos: data.jogadores > 0 ? Number((data.totalPontos / data.jogadores).toFixed(2)) : 0,
      }));
  }, [selectedAtletas, pontuacoesRaw, pontuacoesRodada, atletasDisponiveis]);

  const toggleAtleta = (atletaId: number) => {
    setSelectedAtletas(prev => 
      prev.includes(atletaId) 
        ? prev.filter(id => id !== atletaId)
        : prev.length < 10 ? [...prev, atletaId] : prev
    );
  };

  const clearFilters = () => {
    setSelectedAtletas([]);
  };

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
                Total de Usuários
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {userStats.totalUsers}
              </div>
              <p className="text-xs text-muted-foreground">
                +{userStats.newUsersThisMonth} este mês
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Usuários Ativos
              </CardTitle>
              <UserCheck className="h-4 w-4 text-neon-green" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {userStats.activeUsers}
              </div>
              <p className="text-xs text-muted-foreground">
                {userStats.totalUsers > 0 
                  ? Math.round((userStats.activeUsers / userStats.totalUsers) * 100)
                  : 0}% do total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Jogadores
              </CardTitle>
              <Database className="h-4 w-4 text-neon-yellow" />
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
                Taxa de Sucesso Sync
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stats.totalSyncs > 0
                  ? Math.round((stats.successfulSyncs / stats.totalSyncs) * 100)
                  : 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Registration Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Cadastros nos Últimos 30 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={registrationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    interval={4}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: number) => [value, "Novos usuários"]}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    name="Cadastros"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Evolution by Round Chart */}
        {pontuacoesRodada.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Evolução de Pontuação por Rodada
              </CardTitle>
              <div className="flex items-center gap-2">
                {selectedAtletas.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpar ({selectedAtletas.length})
                  </Button>
                )}
                <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      <Filter className="h-4 w-4 mr-2" />
                      Filtrar Jogadores
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0 bg-popover border-border z-50" align="end">
                    <Command className="bg-transparent">
                      <CommandInput placeholder="Buscar jogador..." className="border-b border-border" />
                      <CommandList className="max-h-64">
                        <CommandEmpty>Nenhum jogador encontrado.</CommandEmpty>
                        <CommandGroup>
                          {atletasDisponiveis.map((atleta) => (
                            <CommandItem
                              key={atleta.id}
                              onSelect={() => toggleAtleta(atleta.id)}
                              className="cursor-pointer flex items-center gap-2"
                            >
                              <Checkbox 
                                checked={selectedAtletas.includes(atleta.id)}
                                className="pointer-events-none"
                              />
                              <span>{atleta.apelido}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    {selectedAtletas.length >= 10 && (
                      <p className="text-xs text-muted-foreground p-2 border-t border-border">
                        Máximo de 10 jogadores selecionados
                      </p>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            
            {/* Selected players badges */}
            {selectedAtletas.length > 0 && (
              <div className="px-6 pb-2 flex flex-wrap gap-1">
                {selectedAtletas.map((atletaId, index) => {
                  const atleta = atletasDisponiveis.find(a => a.id === atletaId);
                  return (
                    <Badge 
                      key={atletaId} 
                      variant="secondary"
                      className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      style={{ borderLeft: `3px solid ${CHART_COLORS[index % CHART_COLORS.length]}` }}
                      onClick={() => toggleAtleta(atletaId)}
                    >
                      {atleta?.apelido || `ID ${atletaId}`}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  );
                })}
              </div>
            )}
            
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="rodada" 
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
                      formatter={(value: number, name: string) => {
                        if (name.startsWith("atleta_")) {
                          const atletaId = parseInt(name.replace("atleta_", ""));
                          const atleta = atletasDisponiveis.find(a => a.id === atletaId);
                          return [value.toFixed(2), atleta?.apelido || name];
                        }
                        const label = name === "mediaPontos" ? "Média" : name === "totalPontos" ? "Total" : name;
                        return [value.toFixed(2), label];
                      }}
                    />
                    <Legend 
                      formatter={(value) => {
                        if (value.startsWith("atleta_")) {
                          const atletaId = parseInt(value.replace("atleta_", ""));
                          const atleta = atletasDisponiveis.find(a => a.id === atletaId);
                          return atleta?.apelido || value;
                        }
                        if (value === "mediaPontos") return "Média de Pontos";
                        if (value === "totalPontos") return "Total de Pontos";
                        return value;
                      }}
                    />
                    
                    {selectedAtletas.length === 0 ? (
                      <>
                        <Line
                          type="monotone"
                          dataKey="mediaPontos"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--primary))", r: 4 }}
                          activeDot={{ r: 6 }}
                          name="mediaPontos"
                        />
                        <Line
                          type="monotone"
                          dataKey="totalPontos"
                          stroke="hsl(var(--chart-2))"
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--chart-2))", r: 4 }}
                          activeDot={{ r: 6 }}
                          name="totalPontos"
                        />
                      </>
                    ) : (
                      selectedAtletas.map((atletaId, index) => (
                        <Line
                          key={atletaId}
                          type="monotone"
                          dataKey={`atleta_${atletaId}`}
                          stroke={CHART_COLORS[index % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={{ fill: CHART_COLORS[index % CHART_COLORS.length], r: 4 }}
                          activeDot={{ r: 6 }}
                          name={`atleta_${atletaId}`}
                          connectNulls
                        />
                      ))
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                {selectedAtletas.length === 0 
                  ? "Média de pontos e total de pontos por rodada (geral)"
                  : `Pontuação individual por rodada (${selectedAtletas.length} jogador${selectedAtletas.length > 1 ? 'es' : ''} selecionado${selectedAtletas.length > 1 ? 's' : ''})`
                }
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

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
  AlertCircle
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

const AdminDashboard = () => {
  const [syncHistory, setSyncHistory] = useState<SyncAnalytics[]>([]);
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
            Estatísticas de sincronização e dados do sistema
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

        {/* Charts */}
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

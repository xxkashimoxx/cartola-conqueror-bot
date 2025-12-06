import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  RefreshCw, 
  Database, 
  Users, 
  CheckCircle,
  AlertCircle
} from "lucide-react";

const AdminSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    stats?: any;
  } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSync = async () => {
    setSyncing(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("sync-cartola-data");

      if (error) throw error;

      // Log sync to analytics
      if (user) {
        await supabase.from("sync_analytics").insert({
          sync_type: "full_sync",
          records_synced: data?.stats?.athletes || 0,
          success: true,
          synced_by: user.id,
        });
      }

      setLastResult({
        success: true,
        message: "Sincronização concluída com sucesso!",
        stats: data?.stats,
      });

      toast({
        title: "Sincronização Completa",
        description: `${data?.stats?.athletes || 0} jogadores sincronizados`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      // Log failed sync
      if (user) {
        await supabase.from("sync_analytics").insert({
          sync_type: "full_sync",
          records_synced: 0,
          success: false,
          error_message: errorMessage,
          synced_by: user.id,
        });
      }

      setLastResult({
        success: false,
        message: errorMessage,
      });

      toast({
        title: "Erro na Sincronização",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-neon-cyan">Sincronização</h1>
          <p className="text-muted-foreground">
            Sincronize os dados da API do Cartola FC
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Sincronização Completa
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Sincroniza todos os dados do Cartola: status do mercado, clubes e
                jogadores
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="w-full gap-2"
                size="lg"
              >
                <RefreshCw className={`h-5 w-5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : "Iniciar Sincronização"}
              </Button>

              {lastResult && (
                <div
                  className={`p-4 rounded-lg flex items-start gap-3 ${
                    lastResult.success
                      ? "bg-success/10 border border-success/30"
                      : "bg-destructive/10 border border-destructive/30"
                  }`}
                >
                  {lastResult.success ? (
                    <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  )}
                  <div>
                    <p
                      className={`font-medium ${
                        lastResult.success ? "text-success" : "text-destructive"
                      }`}
                    >
                      {lastResult.message}
                    </p>
                    {lastResult.stats && (
                      <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                        <li>• {lastResult.stats.clubs || 0} clubes</li>
                        <li>• {lastResult.stats.athletes || 0} jogadores</li>
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-neon-green" />
                Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                  <p className="text-muted-foreground">
                    A sincronização busca dados diretamente da API oficial do
                    Cartola FC
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                  <p className="text-muted-foreground">
                    Os dados são atualizados usando upsert, evitando duplicatas
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                  <p className="text-muted-foreground">
                    Todas as sincronizações são registradas no histórico de
                    analytics
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                  <p className="text-muted-foreground">
                    Recomenda-se sincronizar após cada rodada do Cartola
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSync;

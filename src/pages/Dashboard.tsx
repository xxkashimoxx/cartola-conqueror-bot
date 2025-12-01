import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, Minus, Users, Trophy, RefreshCw } from "lucide-react";

interface Player {
  id: number;
  rank: number;
  name: string;
  fullName: string;
  position: string;
  team: string;
  teamName: string;
  shield?: string;
  photo?: string;
  price: number;
  predictedScore: number;
  probability: number;
  trend: 'up' | 'down' | 'stable';
  average: number;
  games: number;
  totalPoints: number;
}

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('get-top-players', {
        body: { limit: 20 }
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        setPlayers(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar jogadores:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados dos jogadores",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const syncCartolaData = async () => {
    try {
      setSyncing(true);
      toast({
        title: "Sincronizando...",
        description: "Buscando dados atualizados do Cartola FC",
      });

      const { data, error } = await supabase.functions.invoke('sync-cartola-data');

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Sincronização concluída!",
          description: `${data.atletas} atletas e ${data.clubes} clubes atualizados`,
        });
        await fetchPlayers();
      }
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar com o Cartola FC",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPlayers();
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Até a próxima!",
      description: "Você saiu da conta com sucesso",
    });
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 text-neon-cyan animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b-2 border-border shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h1 className="text-neon-cyan font-black text-3xl md:text-4xl tracking-wider">
              XXKASHIMOXX
            </h1>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button
                onClick={syncCartolaData}
                disabled={syncing}
                variant="outline"
                className="border-2 border-neon-cyan hover:bg-card"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Atualizar Dados'}
              </Button>
              <Button
                onClick={() => navigate("/compare")}
                variant="outline"
                className="border-2 border-border hover:bg-card"
              >
                <Users className="mr-2 h-4 w-4" />
                Comparar
              </Button>
              <Button
                onClick={() => navigate("/team-builder")}
                className="bg-primary hover:bg-primary/80 shadow-neon"
              >
                <Trophy className="mr-2 h-4 w-4" />
                Meu Time
              </Button>
              <Button
                onClick={handleLogout}
                variant="destructive"
                className="border-2 border-destructive shadow-danger"
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-neon-red font-black text-2xl md:text-3xl mb-2">
            TOP ATLETAS DO CARTOLA
          </h2>
          <p className="text-muted-foreground text-lg">
            Dados reais da API oficial do Cartola FC
          </p>
        </div>

        {players.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              Nenhum dado disponível. Clique em "Atualizar Dados" para sincronizar com o Cartola FC.
            </p>
            <Button onClick={syncCartolaData} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              Sincronizar Agora
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {players.map((player) => (
              <Card key={player.id} className="bg-card border-2 border-border hover:border-primary transition-all duration-300 shadow-lg hover:shadow-neon overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-black text-neon-cyan">
                        #{player.rank}
                      </span>
                      {player.shield && (
                        <img 
                          src={player.shield} 
                          alt={player.teamName}
                          className="w-8 h-8 object-contain"
                        />
                      )}
                      <div>
                        <h3 className="font-bold text-foreground text-lg">
                          {player.name}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {player.position} • {player.team}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm font-medium">
                        Previsão
                      </span>
                      <span className="text-neon-green font-bold text-xl">
                        {player.predictedScore.toFixed(1)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-sm">
                          Probabilidade
                        </span>
                        <span className="text-foreground font-bold">
                          {player.probability}%
                        </span>
                      </div>
                      <Progress value={player.probability} className="h-2" />
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-border">
                      <span className="text-muted-foreground text-sm">
                        Média
                      </span>
                      <span className="text-foreground font-bold">
                        {player.average?.toFixed(2) || '0.00'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">
                        Preço
                      </span>
                      <span className="text-neon-yellow font-bold">
                        C$ {player.price?.toFixed(1) || '0.0'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">
                        Tendência
                      </span>
                      <div className="flex items-center gap-1">
                        {player.trend === 'up' && (
                          <>
                            <TrendingUp className="h-4 w-4 text-neon-green" />
                            <span className="text-neon-green text-sm font-bold">
                              Alta
                            </span>
                          </>
                        )}
                        {player.trend === 'down' && (
                          <>
                            <TrendingDown className="h-4 w-4 text-neon-red" />
                            <span className="text-neon-red text-sm font-bold">
                              Baixa
                            </span>
                          </>
                        )}
                        {player.trend === 'stable' && (
                          <>
                            <Minus className="h-4 w-4 text-neon-yellow" />
                            <span className="text-neon-yellow text-sm font-bold">
                              Estável
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

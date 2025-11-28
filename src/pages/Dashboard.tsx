import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LogOut, TrendingUp, TrendingDown, Target, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Player {
  id: number;
  name: string;
  position: string;
  team: string;
  predictedScore: number;
  probability: number;
  trend: "up" | "down" | "stable";
  price: number;
}

const mockPlayers: Player[] = [
  { id: 1, name: "Pedro", position: "ATA", team: "FLA", predictedScore: 12.5, probability: 87, trend: "up", price: 28.5 },
  { id: 2, name: "Arrascaeta", position: "MEI", team: "FLA", predictedScore: 11.2, probability: 82, trend: "up", price: 22.3 },
  { id: 3, name: "Gabi Gol", position: "ATA", team: "FLA", predictedScore: 10.8, probability: 79, trend: "stable", price: 24.1 },
  { id: 4, name: "Hulk", position: "ATA", team: "CAM", predictedScore: 10.5, probability: 75, trend: "up", price: 26.7 },
  { id: 5, name: "Paulinho", position: "ATA", team: "CAM", predictedScore: 9.7, probability: 71, trend: "down", price: 18.9 },
  { id: 6, name: "Piton", position: "LAT", team: "FLU", predictedScore: 9.3, probability: 68, trend: "up", price: 12.4 },
  { id: 7, name: "Everton Ribeiro", position: "MEI", team: "BAH", predictedScore: 8.9, probability: 65, trend: "stable", price: 15.8 },
  { id: 8, name: "Calleri", position: "ATA", team: "SAO", predictedScore: 8.5, probability: 62, trend: "down", price: 19.2 },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/auth");
      }
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Até a próxima batalha!",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black text-neon-cyan uppercase tracking-wider">
              XXKASHIMOXX
            </h1>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigate("/compare")}
                className="border-primary text-foreground"
              >
                <Target className="mr-2 h-4 w-4" />
                Comparar
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/team-builder")}
                className="border-primary text-foreground"
              >
                <Users className="mr-2 h-4 w-4" />
                Meu Time
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="border-destructive text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-black text-foreground mb-2 uppercase">
            PREVISÕES DA RODADA
          </h2>
          <p className="text-muted-foreground">
            Top jogadores com maior probabilidade de pontuação alta
          </p>
        </div>

        <div className="grid gap-4">
          {mockPlayers.map((player, index) => (
            <Card key={player.id} className="bg-card border-border hover:border-primary transition-all duration-300 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-black text-neon-cyan w-12">
                    #{index + 1}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{player.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {player.position} • {player.team} • C$ {player.price.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <div className="text-3xl font-black text-neon-green">
                      {player.predictedScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground uppercase">Pontos</div>
                  </div>

                  <div className="text-center min-w-[120px]">
                    <div className="text-2xl font-bold text-foreground">
                      {player.probability}%
                    </div>
                    <Progress value={player.probability} className="h-2 mt-2" />
                    <div className="text-xs text-muted-foreground uppercase mt-1">Confiança</div>
                  </div>

                  <div className="text-center">
                    {player.trend === "up" && (
                      <TrendingUp className="h-8 w-8 text-neon-green" />
                    )}
                    {player.trend === "down" && (
                      <TrendingDown className="h-8 w-8 text-neon-red" />
                    )}
                    {player.trend === "stable" && (
                      <div className="h-8 w-8 flex items-center justify-center">
                        <div className="h-1 w-6 bg-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

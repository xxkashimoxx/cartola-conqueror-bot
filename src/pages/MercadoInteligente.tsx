import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCw, Crown, Home, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUserPlan } from "@/hooks/useUserPlan";
import LockedFeature, { canAccess } from "@/components/LockedFeature";
import { supabase } from "@/integrations/supabase/client";

interface PlayerMarket {
  id: number;
  apelido: string;
  nome: string;
  preco: number;
  variacao_preco: number;
  media: number;
  jogos: number;
  foto_url: string | null;
  clube: string;
  clube_nome: string;
  escudo_url: string | null;
  posicao: string;
  posicao_nome: string;
  emCasa?: boolean;
  visitante?: boolean;
  motivo: string;
  tipo: 'valorizar' | 'desvalorizar';
}

const MercadoInteligente = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { plan, loading: loadingPlan } = useUserPlan();
  const [valorizar, setValorizar] = useState<PlayerMarket[]>([]);
  const [desvalorizar, setDesvalorizar] = useState<PlayerMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [rodada, setRodada] = useState(1);
  const [totalValorizar, setTotalValorizar] = useState(0);
  const [totalDesvalorizar, setTotalDesvalorizar] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercado-inteligente', {
        body: {},
        headers: {},
      });

      // Passar o plano via query param
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercado-inteligente?plan=${plan}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Erro ao buscar dados');

      const result = await response.json();
      setValorizar(result.valorizar || []);
      setDesvalorizar(result.desvalorizar || []);
      setRodada(result.rodada || 1);
      setTotalValorizar(result.totalValorizar || 0);
      setTotalDesvalorizar(result.totalDesvalorizar || 0);
    } catch (err) {
      console.error('Erro ao buscar mercado:', err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do mercado",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingPlan) {
      fetchData();
    }
  }, [plan, loadingPlan]);

  if (loadingPlan || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Analisando mercado...</p>
        </div>
      </div>
    );
  }

  const PlayerCard = ({ player }: { player: PlayerMarket }) => (
    <Card className="bg-card/50 border-border hover:border-primary/50 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {player.foto_url ? (
            <img
              src={player.foto_url}
              alt={player.apelido}
              className="w-12 h-12 rounded-full object-cover bg-muted"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <span className="text-lg font-bold text-muted-foreground">
                {player.apelido.charAt(0)}
              </span>
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-foreground truncate">{player.apelido}</h3>
              {player.escudo_url && (
                <img src={player.escudo_url} alt={player.clube} className="w-5 h-5" />
              )}
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Badge variant="outline" className="text-xs">{player.posicao}</Badge>
              <span>{player.clube}</span>
              {player.emCasa && (
                <Badge className="bg-green-500/20 text-green-400 text-xs">
                  <Home className="w-3 h-3 mr-1" /> Casa
                </Badge>
              )}
              {player.visitante && (
                <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                  <Plane className="w-3 h-3 mr-1" /> Fora
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm mb-2">
              <div>
                <span className="text-muted-foreground text-xs">Preço</span>
                <p className="font-bold text-foreground">C$ {player.preco?.toFixed(1)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Média</span>
                <p className="font-bold text-foreground">{player.media?.toFixed(1)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Variação</span>
                <p className={`font-bold ${(player.variacao_preco || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(player.variacao_preco || 0) >= 0 ? '+' : ''}{player.variacao_preco?.toFixed(2)}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
              {player.motivo}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                Mercado Inteligente
              </h1>
              <p className="text-sm text-muted-foreground">Rodada {rodada} - Análise de valorização</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Coluna Valorizar */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                Valorizar
                <Badge className="bg-green-500/20 text-green-400">{valorizar.length}</Badge>
              </h2>
            </div>

            <p className="text-sm text-muted-foreground">
              Jogadores com tendência de valorização: preço acessível, boa média, jogando em casa
            </p>

            {valorizar.length === 0 ? (
              <Card className="bg-card/30 border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  Nenhum candidato encontrado
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {valorizar.map((player) => (
                  <PlayerCard key={player.id} player={player} />
                ))}
              </div>
            )}
          </div>

          {/* Coluna Desvalorizar */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-400" />
                Armadilhas
                <Badge className="bg-red-500/20 text-red-400">{desvalorizar.length}</Badge>
              </h2>
            </div>

            <p className="text-sm text-muted-foreground">
              Jogadores com risco de desvalorização: preço alto, queda de rendimento, visitante
            </p>

            {desvalorizar.length === 0 ? (
              <Card className="bg-card/30 border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  Nenhuma armadilha identificada
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {desvalorizar.map((player) => (
                  <PlayerCard key={player.id} player={player} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MercadoInteligente;

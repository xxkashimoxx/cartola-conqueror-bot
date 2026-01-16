import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Flame, 
  Shield, 
  TrendingUp, 
  Scale, 
  Target, 
  ArrowLeft, 
  RefreshCw, 
  Users,
  Coins,
  Trophy,
  Zap
} from "lucide-react";

type EstiloJogo = 'AGRESSIVO' | 'CONSERVADOR' | 'PATRIMONIO' | 'LIGA_CLASSICA' | 'TIRO_CURTO';

interface PlayerResult {
  id: number;
  nome: string;
  apelido: string;
  foto: string | null;
  posicao: string;
  posicao_id: number;
  clube: string;
  clube_id: number;
  escudo: string | null;
  preco: number;
  media: number;
  pontuacao_rodada: number;
  score: number;
  motivo: string;
}

interface Estatisticas {
  totalJogadores: number;
  gastoTotal: number;
  cartoletas: number;
  saldoRestante: number;
  pontosPrevistos: number;
  mediaGeral: number;
}

interface DescricaoEstilo {
  titulo: string;
  descricao: string;
  icone: string;
}

interface GeracaoResult {
  estilo: EstiloJogo;
  escalacao: PlayerResult[];
  estatisticas: Estatisticas;
  descricaoEstilo: DescricaoEstilo;
}

const estilos: { id: EstiloJogo; nome: string; descricao: string; icone: React.ReactNode; cor: string }[] = [
  {
    id: 'AGRESSIVO',
    nome: 'Agressivo',
    descricao: 'Alta pontuação recente. Alto risco, alto retorno.',
    icone: <Flame className="h-6 w-6" />,
    cor: 'border-neon-red hover:bg-neon-red/10',
  },
  {
    id: 'CONSERVADOR',
    nome: 'Conservador',
    descricao: 'Jogadores consistentes com boa média.',
    icone: <Shield className="h-6 w-6" />,
    cor: 'border-blue-500 hover:bg-blue-500/10',
  },
  {
    id: 'PATRIMONIO',
    nome: 'Patrimônio',
    descricao: 'Jogadores em valorização para crescer cartoletas.',
    icone: <TrendingUp className="h-6 w-6" />,
    cor: 'border-neon-green hover:bg-neon-green/10',
  },
  {
    id: 'LIGA_CLASSICA',
    nome: 'Liga Clássica',
    descricao: 'Custo-benefício para pontos corridos.',
    icone: <Scale className="h-6 w-6" />,
    cor: 'border-neon-yellow hover:bg-neon-yellow/10',
  },
  {
    id: 'TIRO_CURTO',
    nome: 'Tiro Curto',
    descricao: 'Jogadores baratos com bom potencial.',
    icone: <Target className="h-6 w-6" />,
    cor: 'border-purple-500 hover:bg-purple-500/10',
  },
];

const GeradorEstilo = () => {
  const [estiloSelecionado, setEstiloSelecionado] = useState<EstiloJogo | null>(null);
  const [cartoletas, setCartoletas] = useState(100);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<GeracaoResult | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const gerarEscalacao = async () => {
    if (!estiloSelecionado) {
      toast({
        title: "Selecione um estilo",
        description: "Escolha um estilo de jogo antes de gerar a escalação",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('gerador-estilo', {
        body: { estilo: estiloSelecionado, cartoletas }
      });

      if (error) throw error;

      if (data?.success) {
        setResultado(data.data);
        toast({
          title: "Escalação gerada!",
          description: `${data.data.estatisticas.totalJogadores} jogadores selecionados`,
        });
      } else {
        throw new Error(data?.error || 'Erro ao gerar escalação');
      }
    } catch (error) {
      console.error('Erro ao gerar escalação:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível gerar a escalação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getEstiloColor = (posicaoId: number) => {
    switch (posicaoId) {
      case 1: return 'bg-yellow-500/20 border-yellow-500';
      case 2: return 'bg-blue-500/20 border-blue-500';
      case 3: return 'bg-green-500/20 border-green-500';
      case 4: return 'bg-purple-500/20 border-purple-500';
      case 5: return 'bg-red-500/20 border-red-500';
      case 6: return 'bg-gray-500/20 border-gray-500';
      default: return 'bg-muted border-border';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b-2 border-border shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate("/dashboard")}
                variant="outline"
                size="icon"
                className="border-2 border-border"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-neon-cyan font-black text-2xl md:text-3xl tracking-wider">
                  Gerador por Estilo
                </h1>
                <p className="text-muted-foreground text-sm">
                  Monte sua escalação baseada em estratégias inteligentes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Seleção de Estilo */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-neon-yellow" />
            Escolha seu Estilo de Jogo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {estilos.map((estilo) => (
              <Card
                key={estilo.id}
                className={`cursor-pointer transition-all duration-300 border-2 ${estilo.cor} ${
                  estiloSelecionado === estilo.id 
                    ? 'ring-2 ring-primary shadow-neon' 
                    : 'hover:shadow-lg'
                }`}
                onClick={() => setEstiloSelecionado(estilo.id)}
              >
                <CardContent className="p-4 text-center">
                  <div className={`mx-auto mb-3 p-3 rounded-full w-fit ${
                    estiloSelecionado === estilo.id ? 'bg-primary/20' : 'bg-muted'
                  }`}>
                    {estilo.icone}
                  </div>
                  <h3 className="font-bold text-foreground mb-1">{estilo.nome}</h3>
                  <p className="text-xs text-muted-foreground">{estilo.descricao}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Configurações */}
        <Card className="mb-8 border-2 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-neon-yellow" />
              Configurações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6 items-end">
              <div className="flex-1">
                <Label htmlFor="cartoletas" className="text-muted-foreground">
                  Cartoletas Disponíveis
                </Label>
                <Input
                  id="cartoletas"
                  type="number"
                  value={cartoletas}
                  onChange={(e) => setCartoletas(Number(e.target.value))}
                  min={50}
                  max={200}
                  className="mt-2 border-2 border-border bg-background"
                />
              </div>
              <Button
                onClick={gerarEscalacao}
                disabled={loading || !estiloSelecionado}
                className="bg-primary hover:bg-primary/80 shadow-neon min-w-[200px]"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Trophy className="mr-2 h-4 w-4" />
                    Gerar Escalação
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultado */}
        {resultado && (
          <div className="space-y-6">
            {/* Estatísticas */}
            <Card className="border-2 border-primary/50 bg-gradient-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">{resultado.descricaoEstilo.icone}</span>
                  {resultado.descricaoEstilo.titulo}
                </CardTitle>
                <p className="text-muted-foreground">{resultado.descricaoEstilo.descricao}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-card p-4 rounded-lg border border-border">
                    <p className="text-muted-foreground text-sm">Jogadores</p>
                    <p className="text-2xl font-bold text-foreground flex items-center gap-2">
                      <Users className="h-5 w-5 text-neon-cyan" />
                      {resultado.estatisticas.totalJogadores}
                    </p>
                  </div>
                  <div className="bg-card p-4 rounded-lg border border-border">
                    <p className="text-muted-foreground text-sm">Gasto Total</p>
                    <p className="text-2xl font-bold text-neon-yellow">
                      C$ {resultado.estatisticas.gastoTotal.toFixed(1)}
                    </p>
                  </div>
                  <div className="bg-card p-4 rounded-lg border border-border">
                    <p className="text-muted-foreground text-sm">Saldo Restante</p>
                    <p className="text-2xl font-bold text-neon-green">
                      C$ {resultado.estatisticas.saldoRestante.toFixed(1)}
                    </p>
                  </div>
                  <div className="bg-card p-4 rounded-lg border border-border">
                    <p className="text-muted-foreground text-sm">Pontos Previstos</p>
                    <p className="text-2xl font-bold text-neon-cyan">
                      {resultado.estatisticas.pontosPrevistos.toFixed(1)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Jogadores */}
            <Card className="border-2 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Escalação Gerada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {resultado.escalacao.map((player) => (
                    <div
                      key={player.id}
                      className={`p-4 rounded-lg border-2 ${getEstiloColor(player.posicao_id)} transition-all hover:shadow-lg`}
                    >
                      <div className="flex items-start gap-3">
                        {player.escudo && (
                          <img
                            src={player.escudo}
                            alt={player.clube}
                            className="w-10 h-10 object-contain"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-foreground truncate">
                              {player.apelido}
                            </h4>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {player.posicao}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {player.clube}
                          </p>
                          <p className="text-xs text-neon-cyan mb-2">
                            {player.motivo}
                          </p>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Média: <span className="text-foreground font-medium">{player.media.toFixed(1)}</span>
                            </span>
                            <span className="text-neon-yellow font-bold">
                              C$ {player.preco.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeradorEstilo;

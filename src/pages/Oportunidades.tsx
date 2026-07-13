import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, TrendingUp, Zap, Gem, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Oportunidade {
  id: string;
  atleta_id: number;
  tipo: string;
  nota: string | null;
  score: number;
  atleta: {
    id: number;
    apelido: string;
    nome: string;
    preco: number;
    media: number;
    foto_url: string | null;
    clube: string;
    escudo_url: string | null;
    posicao: string;
  };
  source: 'manual' | 'auto';
}

const tipoConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  'APOSTA_DA_RODADA': {
    label: 'Aposta da Rodada',
    icon: <Zap className="h-4 w-4" />,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
  },
  'SUBESTIMADO': {
    label: 'Subestimado',
    icon: <Gem className="h-4 w-4" />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
  },
  'BARATO_EXPLOSAO': {
    label: 'Barato com Explosão',
    icon: <TrendingUp className="h-4 w-4" />,
    color: 'text-green-400',
    bg: 'bg-green-500/20',
  },
};

const Oportunidades = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const loadingPlan = false;
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [rodada, setRodada] = useState(1);

  const fetchOportunidades = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('oportunidades');

      if (error) throw error;

      setOportunidades(data.oportunidades || []);
      setRodada(data.rodada || 1);
    } catch (err) {
      console.error('Erro ao buscar oportunidades:', err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as oportunidades",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingPlan) {
      fetchOportunidades();
    }
  }, [loadingPlan]);

  if (loadingPlan || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Buscando oportunidades...</p>
        </div>
      </div>
    );
  }


  // Agrupar por tipo
  const apostas = oportunidades.filter(o => o.tipo === 'APOSTA_DA_RODADA');
  const subestimados = oportunidades.filter(o => o.tipo === 'SUBESTIMADO');
  const baratos = oportunidades.filter(o => o.tipo === 'BARATO_EXPLOSAO');

  const OportunidadeCard = ({ op }: { op: Oportunidade }) => {
    const config = tipoConfig[op.tipo] || tipoConfig['SUBESTIMADO'];
    
    return (
      <Card className="bg-card/50 border-border hover:border-primary/50 transition-all overflow-hidden">
        <div className={`h-1 ${config.bg.replace('/20', '')}`} />
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {op.atleta.foto_url ? (
              <img
                src={op.atleta.foto_url}
                alt={op.atleta.apelido}
                className="w-14 h-14 rounded-full object-cover bg-muted"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <span className="text-xl font-bold text-muted-foreground">
                  {op.atleta.apelido.charAt(0)}
                </span>
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-foreground text-lg truncate">{op.atleta.apelido}</h3>
                {op.atleta.escudo_url && (
                  <img src={op.atleta.escudo_url} alt={op.atleta.clube} className="w-5 h-5" />
                )}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Badge variant="outline" className="text-xs">{op.atleta.posicao}</Badge>
                <span>{op.atleta.clube}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center p-2 bg-muted/30 rounded">
                  <p className="text-xs text-muted-foreground">Preço</p>
                  <p className="font-bold text-foreground">C$ {op.atleta.preco?.toFixed(1)}</p>
                </div>
                <div className="text-center p-2 bg-muted/30 rounded">
                  <p className="text-xs text-muted-foreground">Média</p>
                  <p className="font-bold text-foreground">{op.atleta.media?.toFixed(1)}</p>
                </div>
                <div className="text-center p-2 bg-primary/10 rounded">
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="font-bold text-primary">{op.score?.toFixed(1)}</p>
                </div>
              </div>

              {op.nota && (
                <p className="text-sm text-muted-foreground bg-muted/20 p-2 rounded italic">
                  "{op.nota}"
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const Section = ({ 
    title, 
    items, 
    config 
  }: { 
    title: string; 
    items: Oportunidade[]; 
    config: typeof tipoConfig[string] 
  }) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${config.bg}`}>
          <span className={config.color}>{config.icon}</span>
        </div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <Badge className={`${config.bg} ${config.color}`}>{items.length}</Badge>
      </div>
      
      {items.length === 0 ? (
        <Card className="bg-card/30 border-dashed">
          <CardContent className="p-6 text-center text-muted-foreground">
            Nenhuma oportunidade nesta categoria
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((op) => (
            <OportunidadeCard key={op.id} op={op} />
          ))}
        </div>
      )}
    </div>
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
                <Sparkles className="h-5 w-5 text-yellow-400" />
                Oportunidades
              </h1>
              <p className="text-sm text-muted-foreground">Rodada {rodada} - Jogadores com alto potencial</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchOportunidades} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-8">
        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-500/20">
                <Zap className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{apostas.length}</p>
                <p className="text-sm text-muted-foreground">Apostas da Rodada</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/20">
                <Gem className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{subestimados.length}</p>
                <p className="text-sm text-muted-foreground">Subestimados</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/20">
                <TrendingUp className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{baratos.length}</p>
                <p className="text-sm text-muted-foreground">Baratos com Explosão</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Seções */}
        <Section 
          title="Apostas da Rodada" 
          items={apostas} 
          config={tipoConfig['APOSTA_DA_RODADA']} 
        />
        
        <Section 
          title="Jogadores Subestimados" 
          items={subestimados} 
          config={tipoConfig['SUBESTIMADO']} 
        />
        
        <Section 
          title="Baratos com Potencial de Explosão" 
          items={baratos} 
          config={tipoConfig['BARATO_EXPLOSAO']} 
        />

        {oportunidades.length === 0 && (
          <Card className="bg-card/30 border-dashed">
            <CardContent className="p-12 text-center">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-2">Nenhuma oportunidade encontrada</h3>
              <p className="text-muted-foreground">
                As oportunidades serão geradas com base nos dados dos jogadores e partidas
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Oportunidades;

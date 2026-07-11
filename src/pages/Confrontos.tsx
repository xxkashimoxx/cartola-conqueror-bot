import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserPlan } from "@/hooks/useUserPlan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ArrowLeft, Shield, Swords, ChevronRight, Target, Users } from "lucide-react";
import LockedFeature, { canAccess } from "@/components/LockedFeature";
import RiskBadge from "@/components/RiskBadge";
import { useToast } from "@/hooks/use-toast";

interface Clube {
  id: number;
  nome: string;
  abreviacao: string;
  escudo_url: string;
}

interface Partida {
  id: string;
  rodada: number;
  data_partida: string;
  time_casa: Clube;
  time_fora: Clube;
  clean_sheet_casa: number;
  clean_sheet_fora: number;
  xg_casa: number;
  xg_fora: number;
}

interface Atleta {
  id: number;
  apelido: string;
  nome: string;
  foto_url: string;
  preco: number;
  media: number;
  posicao: { id: number; nome: string; abreviacao: string };
  clube: Clube;
}

interface Recomendacoes {
  casa: { defesa: Atleta[]; ataque: Atleta[] };
  fora: { defesa: Atleta[]; ataque: Atleta[] };
}

interface PartidaDetalhada {
  partida: Partida;
  recomendacoes: Recomendacoes;
  nota: string;
}

const Confrontos = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { plan } = useUserPlan();
  const { toast } = useToast();
  
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [loading, setLoading] = useState(true);
  const [rodadaAtual, setRodadaAtual] = useState(1);
  const [selectedPartida, setSelectedPartida] = useState<PartidaDetalhada | null>(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      /* auth desativado */
    }
  }, [user, authLoading, navigate]);

  const fetchPartidas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('confrontos');

      if (error) throw error;

      if (data?.success) {
        setPartidas(data.data || []);
        setRodadaAtual(data.rodada);
      }
    } catch (error) {
      console.error('Erro ao buscar confrontos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os confrontos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDetalhes = async (partidaId: string) => {
    // Check plan access for detailed recommendations
    if (!canAccess(plan, 'PREMIUM')) {
      toast({
        title: "Acesso restrito",
        description: "Recomendações por setor requerem plano Premium",
      });
      return;
    }

    try {
      setLoadingDetalhes(true);
      const { data, error } = await supabase.functions.invoke('confrontos', {
        body: { id: partidaId }
      });

      if (error) throw error;

      if (data?.success) {
        setSelectedPartida(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPartidas();
    }
  }, [user]);

  const formatarData = (data: string) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRiscoSG = (sg: number): 'baixo' | 'medio' | 'alto' => {
    if (sg >= 0.4) return 'alto';
    if (sg >= 0.25) return 'medio';
    return 'baixo';
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-12 w-12 text-neon-cyan animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b-2 border-border shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-neon-cyan font-black text-2xl md:text-3xl tracking-wider flex items-center gap-2">
                  <Swords className="h-7 w-7" />
                  CONFRONTOS
                </h1>
                <p className="text-muted-foreground">Rodada {rodadaAtual}</p>
              </div>
            </div>
            <Button onClick={fetchPartidas} variant="outline" disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {partidas.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              Nenhum confronto encontrado para esta rodada.
            </p>
            <p className="text-sm text-muted-foreground">
              Os confrontos são sincronizados automaticamente ou podem ser adicionados pelo admin.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {partidas.map((partida) => (
              <Card 
                key={partida.id} 
                className="bg-card border-2 border-border hover:border-primary transition-all cursor-pointer"
                onClick={() => fetchDetalhes(partida.id)}
              >
                <CardContent className="p-6">
                  {/* Times */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 flex-1">
                      {partida.time_casa?.escudo_url && (
                        <img 
                          src={partida.time_casa.escudo_url} 
                          alt={partida.time_casa.nome}
                          className="w-10 h-10 object-contain"
                        />
                      )}
                      <span className="font-bold text-foreground">
                        {partida.time_casa?.abreviacao || 'TBA'}
                      </span>
                    </div>
                    
                    <span className="text-muted-foreground text-sm px-3">vs</span>
                    
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className="font-bold text-foreground">
                        {partida.time_fora?.abreviacao || 'TBA'}
                      </span>
                      {partida.time_fora?.escudo_url && (
                        <img 
                          src={partida.time_fora.escudo_url} 
                          alt={partida.time_fora.nome}
                          className="w-10 h-10 object-contain"
                        />
                      )}
                    </div>
                  </div>

                  {/* Data */}
                  <p className="text-center text-sm text-muted-foreground mb-4">
                    {formatarData(partida.data_partida)}
                  </p>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-secondary/30 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="h-4 w-4 text-neon-cyan" />
                        <span className="text-muted-foreground">SG Casa</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">
                          {(partida.clean_sheet_casa * 100).toFixed(0)}%
                        </span>
                        <RiskBadge level={getRiscoSG(partida.clean_sheet_casa)} />
                      </div>
                    </div>

                    <div className="bg-secondary/30 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="h-4 w-4 text-neon-red" />
                        <span className="text-muted-foreground">SG Fora</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">
                          {(partida.clean_sheet_fora * 100).toFixed(0)}%
                        </span>
                        <RiskBadge level={getRiscoSG(partida.clean_sheet_fora)} />
                      </div>
                    </div>

                    <div className="bg-secondary/30 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="h-4 w-4 text-neon-green" />
                        <span className="text-muted-foreground">xG Casa</span>
                      </div>
                      <span className="font-bold text-foreground">
                        {partida.xg_casa?.toFixed(1) || '1.0'}
                      </span>
                    </div>

                    <div className="bg-secondary/30 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="h-4 w-4 text-neon-yellow" />
                        <span className="text-muted-foreground">xG Fora</span>
                      </div>
                      <span className="font-bold text-foreground">
                        {partida.xg_fora?.toFixed(1) || '1.0'}
                      </span>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-4 flex items-center justify-center text-primary text-sm">
                    <span>Ver recomendações</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Premium Lock for recommendations */}
        {!canAccess(plan, 'PREMIUM') && partidas.length > 0 && (
          <div className="mt-8">
            <LockedFeature 
              feature="Recomendações por Setor" 
              currentPlan={plan} 
              requiredPlan="PREMIUM"
            />
          </div>
        )}
      </div>

      {/* Sheet for detailed recommendations */}
      <Sheet open={!!selectedPartida} onOpenChange={() => setSelectedPartida(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {loadingDetalhes ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedPartida && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Recomendações
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Partida Header */}
                <div className="flex items-center justify-center gap-4 p-4 bg-secondary/30 rounded-lg">
                  <div className="text-center">
                    {selectedPartida.partida.time_casa?.escudo_url && (
                      <img 
                        src={selectedPartida.partida.time_casa.escudo_url}
                        alt=""
                        className="w-12 h-12 mx-auto mb-1"
                      />
                    )}
                    <span className="font-bold">{selectedPartida.partida.time_casa?.abreviacao}</span>
                  </div>
                  <span className="text-muted-foreground">vs</span>
                  <div className="text-center">
                    {selectedPartida.partida.time_fora?.escudo_url && (
                      <img 
                        src={selectedPartida.partida.time_fora.escudo_url}
                        alt=""
                        className="w-12 h-12 mx-auto mb-1"
                      />
                    )}
                    <span className="font-bold">{selectedPartida.partida.time_fora?.abreviacao}</span>
                  </div>
                </div>

                {/* Nota */}
                <div className="p-4 bg-primary/10 rounded-lg">
                  <p className="text-sm">{selectedPartida.nota}</p>
                </div>

                {/* Recomendações Casa */}
                <div>
                  <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                    {selectedPartida.partida.time_casa?.escudo_url && (
                      <img src={selectedPartida.partida.time_casa.escudo_url} alt="" className="w-5 h-5" />
                    )}
                    {selectedPartida.partida.time_casa?.nome}
                  </h4>

                  {selectedPartida.recomendacoes.casa.defesa.length > 0 && (
                    <div className="mb-3">
                      <Badge variant="secondary" className="mb-2">
                        <Shield className="h-3 w-3 mr-1" />
                        Defesa
                      </Badge>
                      <div className="space-y-2">
                        {selectedPartida.recomendacoes.casa.defesa.slice(0, 3).map(atleta => (
                          <div key={atleta.id} className="flex items-center gap-3 p-2 bg-secondary/20 rounded">
                            <span className="font-medium">{atleta.apelido}</span>
                            <span className="text-muted-foreground text-sm">{atleta.posicao?.abreviacao}</span>
                            <span className="ml-auto text-neon-green font-bold">{atleta.media?.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPartida.recomendacoes.casa.ataque.length > 0 && (
                    <div>
                      <Badge variant="secondary" className="mb-2">
                        <Target className="h-3 w-3 mr-1" />
                        Ataque
                      </Badge>
                      <div className="space-y-2">
                        {selectedPartida.recomendacoes.casa.ataque.slice(0, 3).map(atleta => (
                          <div key={atleta.id} className="flex items-center gap-3 p-2 bg-secondary/20 rounded">
                            <span className="font-medium">{atleta.apelido}</span>
                            <span className="text-muted-foreground text-sm">{atleta.posicao?.abreviacao}</span>
                            <span className="ml-auto text-neon-green font-bold">{atleta.media?.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recomendações Fora */}
                <div>
                  <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                    {selectedPartida.partida.time_fora?.escudo_url && (
                      <img src={selectedPartida.partida.time_fora.escudo_url} alt="" className="w-5 h-5" />
                    )}
                    {selectedPartida.partida.time_fora?.nome}
                  </h4>

                  {selectedPartida.recomendacoes.fora.defesa.length > 0 && (
                    <div className="mb-3">
                      <Badge variant="secondary" className="mb-2">
                        <Shield className="h-3 w-3 mr-1" />
                        Defesa
                      </Badge>
                      <div className="space-y-2">
                        {selectedPartida.recomendacoes.fora.defesa.slice(0, 3).map(atleta => (
                          <div key={atleta.id} className="flex items-center gap-3 p-2 bg-secondary/20 rounded">
                            <span className="font-medium">{atleta.apelido}</span>
                            <span className="text-muted-foreground text-sm">{atleta.posicao?.abreviacao}</span>
                            <span className="ml-auto text-neon-green font-bold">{atleta.media?.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPartida.recomendacoes.fora.ataque.length > 0 && (
                    <div>
                      <Badge variant="secondary" className="mb-2">
                        <Target className="h-3 w-3 mr-1" />
                        Ataque
                      </Badge>
                      <div className="space-y-2">
                        {selectedPartida.recomendacoes.fora.ataque.slice(0, 3).map(atleta => (
                          <div key={atleta.id} className="flex items-center gap-3 p-2 bg-secondary/20 rounded">
                            <span className="font-medium">{atleta.apelido}</span>
                            <span className="text-muted-foreground text-sm">{atleta.posicao?.abreviacao}</span>
                            <span className="ml-auto text-neon-green font-bold">{atleta.media?.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Confrontos;

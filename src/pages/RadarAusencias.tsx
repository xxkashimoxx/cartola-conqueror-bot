import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ArrowLeft, AlertTriangle, Ban, BedDouble } from "lucide-react";

import { useToast } from "@/hooks/use-toast";

interface Atleta {
  id: number;
  apelido: string;
  nome: string;
  foto_url: string;
  preco: number;
  media: number;
  posicao?: { id: number; nome: string; abreviacao: string };
  clube?: { id: number; nome: string; abreviacao: string; escudo_url: string };
}

interface Ausencia {
  id: string;
  atleta: Atleta;
  tipo: 'LESAO' | 'SUSPENSAO' | 'DESCANSO';
  nota: string;
  probabilidade: number;
  fonte: 'manual' | 'cartola';
}

const tipoConfig = {
  LESAO: {
    icon: AlertTriangle,
    label: 'Lesão',
    bg: 'bg-neon-red/20',
    text: 'text-neon-red',
    border: 'border-neon-red/50',
  },
  SUSPENSAO: {
    icon: Ban,
    label: 'Suspensão',
    bg: 'bg-neon-yellow/20',
    text: 'text-neon-yellow',
    border: 'border-neon-yellow/50',
  },
  DESCANSO: {
    icon: BedDouble,
    label: 'Descanso/Dúvida',
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
  },
};

const RadarAusencias = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const { toast } = useToast();
  
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [rodadaAtual, setRodadaAtual] = useState(1);

  useEffect(() => {
    if (!authLoading && !user) {
      /* auth desativado */
    }
  }, [user, authLoading, navigate]);

  const fetchAusencias = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('ausencias');

      if (error) throw error;

      if (data?.success) {
        setAusencias(data.data || []);
        setRodadaAtual(data.rodada);
      }
    } catch (error) {
      console.error('Erro ao buscar ausências:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as ausências",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAusencias();
    }
  }, [user]);

  if (authLoading) {
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
                  <AlertTriangle className="h-7 w-7" />
                  RADAR DE AUSÊNCIAS
                </h1>
                <p className="text-muted-foreground">Rodada {rodadaAtual}</p>
              </div>
            </div>
            <Button onClick={fetchAusencias} variant="outline" disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : ausencias.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-neon-green mx-auto mb-4" />
            <p className="text-foreground font-bold mb-2">Tudo certo!</p>
            <p className="text-muted-foreground">
              Nenhuma ausência identificada para esta rodada.
            </p>
          </Card>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <Card className="bg-neon-red/10 border-neon-red/30">
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="h-6 w-6 text-neon-red mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground">
                    {ausencias.filter(a => a.tipo === 'LESAO').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Lesões</p>
                </CardContent>
              </Card>
              <Card className="bg-neon-yellow/10 border-neon-yellow/30">
                <CardContent className="p-4 text-center">
                  <Ban className="h-6 w-6 text-neon-yellow mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground">
                    {ausencias.filter(a => a.tipo === 'SUSPENSAO').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Suspensões</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardContent className="p-4 text-center">
                  <BedDouble className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground">
                    {ausencias.filter(a => a.tipo === 'DESCANSO').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Dúvidas</p>
                </CardContent>
              </Card>
            </div>

            {/* List */}
            <div className="space-y-4">
              {ausencias.map((ausencia) => {
                const config = tipoConfig[ausencia.tipo];
                const Icon = config.icon;

                return (
                  <Card 
                    key={ausencia.id} 
                    className={`border-2 ${config.border} transition-all`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Player Photo/Club */}
                        <div className="flex-shrink-0">
                          {ausencia.atleta?.foto_url ? (
                            <img 
                              src={ausencia.atleta.foto_url}
                              alt={ausencia.atleta.apelido}
                              className="w-14 h-14 rounded-full object-cover bg-secondary"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                              <Icon className={`h-6 w-6 ${config.text}`} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-foreground truncate">
                              {ausencia.atleta?.apelido || 'Atleta'}
                            </h3>
                            {ausencia.atleta?.clube?.escudo_url && (
                              <img 
                                src={ausencia.atleta.clube.escudo_url}
                                alt={ausencia.atleta.clube.abreviacao}
                                className="w-5 h-5 object-contain"
                              />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {ausencia.atleta?.posicao?.nome} • {ausencia.atleta?.clube?.nome}
                          </p>
                          <p className="text-sm">{ausencia.nota}</p>
                        </div>

                        {/* Badge */}
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={`${config.bg} ${config.text} border ${config.border}`}>
                            <Icon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {(ausencia.probabilidade * 100).toFixed(0)}% certeza
                          </span>
                          {ausencia.fonte === 'cartola' && (
                            <Badge variant="outline" className="text-xs">
                              Via Cartola
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Player Stats */}
                      <div className="mt-3 pt-3 border-t border-border flex gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Média: </span>
                          <span className="font-bold text-foreground">
                            {ausencia.atleta?.media?.toFixed(2) || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Preço: </span>
                          <span className="font-bold text-neon-yellow">
                            C$ {ausencia.atleta?.preco?.toFixed(1) || '-'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RadarAusencias;

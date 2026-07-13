import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, BarChart3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TeamInput {
  name: string;
  playerIds: string;
}

interface SimulationResult {
  teamIndex: number;
  teamName: string;
  expectedPointsTotal: number;
  totalPrice: number;
  sectors: {
    defense: number;
    midfield: number;
    attack: number;
    tech: number;
  };
  players: Array<{
    id: number;
    apelido: string;
    media: number;
    preco: number;
    posicao_id: number;
    clube: string;
  }>;
}

const Simulador = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const loadingPlan = false;
  const [teams, setTeams] = useState<TeamInput[]>([
    { name: "Time 1", playerIds: "" },
    { name: "Time 2", playerIds: "" },
  ]);
  const [results, setResults] = useState<SimulationResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  const maxTeams = 3;

  const addTeam = () => {
    if (teams.length < maxTeams) {
      setTeams([...teams, { name: `Time ${teams.length + 1}`, playerIds: "" }]);
    }
  };

  const removeTeam = (index: number) => {
    if (teams.length > 2) {
      setTeams(teams.filter((_, i) => i !== index));
    }
  };

  const updateTeam = (index: number, field: keyof TeamInput, value: string) => {
    const newTeams = [...teams];
    newTeams[index][field] = value;
    setTeams(newTeams);
  };

  const simulate = async () => {
    const teamsPayload = teams.map(t => ({
      name: t.name,
      playerIds: t.playerIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)),
    }));

    if (teamsPayload.some(t => t.playerIds.length === 0)) {
      toast({
        title: "Erro",
        description: "Preencha os IDs de jogadores para todos os times",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('simulador', {
        body: { teams: teamsPayload },
      });

      if (error) throw error;
      setResults(data.results);
    } catch (err) {
      console.error('Erro na simulação:', err);
      toast({
        title: "Erro",
        description: "Não foi possível simular os times",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingPlan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }


  const sectorColors = {
    defense: 'bg-blue-500',
    midfield: 'bg-green-500',
    attack: 'bg-red-500',
    tech: 'bg-purple-500',
  };

  const maxSectorValue = results 
    ? Math.max(...results.flatMap(r => [r.sectors.defense, r.sectors.midfield, r.sectors.attack, r.sectors.tech]))
    : 0;

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
                <BarChart3 className="h-5 w-5 text-primary" />
                Simulador
              </h1>
              <p className="text-sm text-muted-foreground">Compare até {maxTeams} times por setores</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Input de Times */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team, index) => (
            <Card key={index} className="bg-card/50 border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Input
                    value={team.name}
                    onChange={(e) => updateTeam(index, 'name', e.target.value)}
                    className="font-bold text-lg bg-transparent border-none p-0 h-auto focus-visible:ring-0"
                  />
                  {teams.length > 2 && (
                    <Button variant="ghost" size="icon" onClick={() => removeTeam(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <label className="text-sm text-muted-foreground mb-2 block">
                  IDs dos jogadores (separados por vírgula)
                </label>
                <Input
                  placeholder="Ex: 123, 456, 789..."
                  value={team.playerIds}
                  onChange={(e) => updateTeam(index, 'playerIds', e.target.value)}
                />
              </CardContent>
            </Card>
          ))}

          {teams.length < maxTeams && (
            <Card 
              className="bg-card/30 border-dashed border-2 border-border cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center min-h-[150px]"
              onClick={addTeam}
            >
              <div className="text-center text-muted-foreground">
                <Plus className="h-8 w-8 mx-auto mb-2" />
                <p>Adicionar Time</p>
              </div>
            </Card>
          )}
        </div>

        <div className="flex justify-center">
          <Button 
            onClick={simulate} 
            disabled={loading}
            className="bg-primary hover:bg-primary/80 shadow-neon px-8"
          >
            {loading ? "Simulando..." : "Simular Comparação"}
          </Button>
        </div>

        {/* Resultados */}
        {results && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Resultado da Simulação
            </h2>

            {/* Gráfico de Barras por Setor */}
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="text-lg">Comparação por Setores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {['defense', 'midfield', 'attack', 'tech'].map((sector) => (
                    <div key={sector} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground capitalize">
                          {sector === 'defense' ? 'Defesa' : 
                           sector === 'midfield' ? 'Meio-campo' : 
                           sector === 'attack' ? 'Ataque' : 'Técnico'}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {results.map((result, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-20 truncate">{result.teamName}</span>
                            <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden">
                              <div
                                className={`h-full ${sectorColors[sector as keyof typeof sectorColors]} transition-all duration-500`}
                                style={{ width: `${maxSectorValue > 0 ? (result.sectors[sector as keyof typeof result.sectors] / maxSectorValue) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold text-foreground w-12 text-right">
                              {result.sectors[sector as keyof typeof result.sectors].toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cards de Resumo */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {results.map((result) => (
                <Card key={result.teamIndex} className="bg-card/50 border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{result.teamName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-primary/10 rounded-lg">
                        <p className="text-2xl font-bold text-primary">{result.expectedPointsTotal.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">Pontos Esperados</p>
                      </div>
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <p className="text-2xl font-bold text-foreground">C$ {result.totalPrice.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">Preço Total</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Por Setor:</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-blue-400">Defesa:</span>
                          <span className="font-bold">{result.sectors.defense.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-400">Meio:</span>
                          <span className="font-bold">{result.sectors.midfield.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-400">Ataque:</span>
                          <span className="font-bold">{result.sectors.attack.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-400">Técnico:</span>
                          <span className="font-bold">{result.sectors.tech.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>

                    {result.players.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {result.players.length} jogadores carregados
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Simulador;

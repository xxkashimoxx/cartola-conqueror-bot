import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Zap } from "lucide-react";

interface PlayerStats {
  name: string;
  position: string;
  team: string;
  predictedScore: number;
  probability: number;
  price: number;
  avgLast5: number;
  goals: number;
  assists: number;
  defense: number;
}

const mockPlayerA: PlayerStats = {
  name: "Pedro",
  position: "ATA",
  team: "FLA",
  predictedScore: 12.5,
  probability: 87,
  price: 28.5,
  avgLast5: 10.2,
  goals: 3,
  assists: 1,
  defense: 0,
};

const mockPlayerB: PlayerStats = {
  name: "Hulk",
  position: "ATA",
  team: "CAM",
  predictedScore: 10.5,
  probability: 75,
  price: 26.7,
  avgLast5: 8.7,
  goals: 2,
  assists: 2,
  defense: 0,
};

const Compare = () => {
  const navigate = useNavigate();
  const [playerA] = useState(mockPlayerA);
  const [playerB] = useState(mockPlayerB);

  const StatComparison = ({ label, valueA, valueB, format = (v: number) => v.toString() }: any) => {
    const isABetter = valueA > valueB;
    return (
      <div className="py-4 border-b border-border">
        <div className="text-center mb-2 text-sm text-muted-foreground uppercase font-bold">
          {label}
        </div>
        <div className="grid grid-cols-3 items-center gap-4">
          <div className={`text-right text-2xl font-bold ${isABetter ? "text-neon-green" : "text-foreground"}`}>
            {format(valueA)}
          </div>
          <div className="text-center">
            <Zap className="h-5 w-5 text-primary mx-auto" />
          </div>
          <div className={`text-left text-2xl font-bold ${!isABetter && valueA !== valueB ? "text-neon-green" : "text-foreground"}`}>
            {format(valueB)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="border-border"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <h1 className="text-2xl font-black text-neon-cyan uppercase tracking-wider">
              COMPARADOR DE GUERRA
            </h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Player A */}
          <Card className="bg-card border-2 border-primary p-6">
            <div className="text-center space-y-4">
              <div className="h-32 w-32 mx-auto bg-gradient-primary rounded-full flex items-center justify-center border-2 border-primary shadow-neon">
                <span className="text-5xl font-black text-neon-cyan">A</span>
              </div>
              <h2 className="text-2xl font-black text-foreground">{playerA.name}</h2>
              <p className="text-muted-foreground">
                {playerA.position} • {playerA.team}
              </p>
              <div className="text-4xl font-black text-neon-green">
                {playerA.predictedScore.toFixed(1)}
              </div>
              <p className="text-sm text-muted-foreground uppercase">Pontos Previstos</p>
            </div>
          </Card>

          {/* Stats Comparison */}
          <Card className="bg-card border-border p-6">
            <StatComparison
              label="Probabilidade"
              valueA={playerA.probability}
              valueB={playerB.probability}
              format={(v: number) => `${v}%`}
            />
            <StatComparison
              label="Preço"
              valueA={playerA.price}
              valueB={playerB.price}
              format={(v: number) => `C$ ${v.toFixed(2)}`}
            />
            <StatComparison
              label="Média 5 Rodadas"
              valueA={playerA.avgLast5}
              valueB={playerB.avgLast5}
              format={(v: number) => v.toFixed(1)}
            />
            <StatComparison
              label="Gols"
              valueA={playerA.goals}
              valueB={playerB.goals}
            />
            <StatComparison
              label="Assistências"
              valueA={playerA.assists}
              valueB={playerB.assists}
            />
          </Card>

          {/* Player B */}
          <Card className="bg-card border-2 border-destructive p-6">
            <div className="text-center space-y-4">
              <div className="h-32 w-32 mx-auto bg-gradient-cyber rounded-full flex items-center justify-center border-2 border-destructive shadow-danger">
                <span className="text-5xl font-black text-neon-red">B</span>
              </div>
              <h2 className="text-2xl font-black text-foreground">{playerB.name}</h2>
              <p className="text-muted-foreground">
                {playerB.position} • {playerB.team}
              </p>
              <div className="text-4xl font-black text-neon-green">
                {playerB.predictedScore.toFixed(1)}
              </div>
              <p className="text-sm text-muted-foreground uppercase">Pontos Previstos</p>
            </div>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Card className="bg-card border-2 border-primary p-6 inline-block shadow-neon">
            <p className="text-lg font-bold text-foreground mb-2">VEREDITO DO ALGORITMO:</p>
            <p className="text-3xl font-black text-neon-green uppercase">
              {playerA.predictedScore > playerB.predictedScore ? playerA.name : playerB.name} DOMINA
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Compare;

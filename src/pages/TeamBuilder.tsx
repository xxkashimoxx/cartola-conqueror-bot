import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Zap, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlayerSlot {
  position: string;
  suggested: {
    name: string;
    team: string;
    predictedScore: number;
    price: number;
  };
}

const mockTeam: PlayerSlot[] = [
  { position: "GOL", suggested: { name: "Santos", team: "FLA", predictedScore: 5.2, price: 8.5 } },
  { position: "LAT", suggested: { name: "Piton", team: "FLU", predictedScore: 9.3, price: 12.4 } },
  { position: "LAT", suggested: { name: "Guga", team: "CAM", predictedScore: 7.8, price: 10.2 } },
  { position: "ZAG", suggested: { name: "Léo Pereira", team: "FLA", predictedScore: 6.5, price: 11.8 } },
  { position: "ZAG", suggested: { name: "Bruno Fuchs", team: "INT", predictedScore: 6.2, price: 9.7 } },
  { position: "MEI", suggested: { name: "Arrascaeta", team: "FLA", predictedScore: 11.2, price: 22.3 } },
  { position: "MEI", suggested: { name: "Everton Ribeiro", team: "BAH", predictedScore: 8.9, price: 15.8 } },
  { position: "MEI", suggested: { name: "Raphael Veiga", team: "PAL", predictedScore: 8.5, price: 18.4 } },
  { position: "ATA", suggested: { name: "Pedro", team: "FLA", predictedScore: 12.5, price: 28.5 } },
  { position: "ATA", suggested: { name: "Hulk", team: "CAM", predictedScore: 10.5, price: 26.7 } },
  { position: "ATA", suggested: { name: "Paulinho", team: "CAM", predictedScore: 9.7, price: 18.9 } },
];

const TeamBuilder = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [team] = useState(mockTeam);

  const totalPrice = team.reduce((sum, slot) => sum + slot.suggested.price, 0);
  const totalPredicted = team.reduce((sum, slot) => sum + slot.suggested.predictedScore, 0);

  const handleGenerateTeam = () => {
    toast({
      title: "Time gerado!",
      description: "Escalação otimizada pelo algoritmo",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
                CONSTRUTOR DE TIME
              </h1>
            </div>
            <Button
              onClick={handleGenerateTeam}
              className="bg-primary hover:bg-primary/80 font-bold shadow-neon"
            >
              <Zap className="mr-2 h-4 w-4" />
              Gerar Time Ideal
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Summary */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-card border-border p-6">
            <div className="text-center">
              <Trophy className="h-8 w-8 text-neon-green mx-auto mb-2" />
              <div className="text-3xl font-black text-neon-green">
                {totalPredicted.toFixed(1)}
              </div>
              <p className="text-sm text-muted-foreground uppercase">Pontos Totais</p>
            </div>
          </Card>
          <Card className="bg-card border-border p-6">
            <div className="text-center">
              <div className="text-3xl font-black text-foreground">
                C$ {totalPrice.toFixed(2)}
              </div>
              <p className="text-sm text-muted-foreground uppercase">Valor Total</p>
            </div>
          </Card>
          <Card className="bg-card border-border p-6">
            <div className="text-center">
              <div className="text-3xl font-black text-foreground">
                C$ {(200 - totalPrice).toFixed(2)}
              </div>
              <p className="text-sm text-muted-foreground uppercase">Saldo Restante</p>
            </div>
          </Card>
        </div>

        {/* Team Formation */}
        <div className="space-y-2">
          {team.map((slot, index) => (
            <Card key={index} className="bg-card border-border hover:border-primary transition-all duration-300 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-primary text-primary-foreground font-black px-4 py-2 rounded uppercase text-sm min-w-[60px] text-center">
                    {slot.position}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{slot.suggested.name}</h3>
                    <p className="text-sm text-muted-foreground">{slot.suggested.team}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-black text-neon-green">
                      {slot.suggested.predictedScore.toFixed(1)}
                    </div>
                    <p className="text-xs text-muted-foreground uppercase">Pontos</p>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-foreground">
                      C$ {slot.suggested.price.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground uppercase">Preço</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Card className="bg-card border-2 border-primary p-6 inline-block shadow-neon">
            <p className="text-lg font-bold text-foreground mb-2">STATUS DA ESCALAÇÃO:</p>
            <p className="text-3xl font-black text-neon-green uppercase">
              OTIMIZADA PARA DESTRUIÇÃO
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TeamBuilder;

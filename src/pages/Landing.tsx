import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Target, TrendingUp, Zap, Shield } from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-cyber opacity-50" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iaHNsKDE3MyAxMDAlIDUwJSAvIDAuMSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />
        
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="text-center space-y-8">
            <h1 className="text-neon-cyan animate-pulse-neon font-black uppercase tracking-wider">
              Precisão &gt; Clubismo
            </h1>
            <p className="text-2xl md:text-3xl text-muted-foreground font-bold">
              A MÁQUINA DE MITADAS DO CARTOLA
            </p>
            <p className="text-xl md:text-2xl text-foreground max-w-3xl mx-auto">
              O app que vai fazer você <span className="text-neon-red">amassar</span> sua liga inteira. Chega de ser refém de palpite furado, bora de ciência pura, mano!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
              <Button 
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-primary hover:bg-primary/80 text-primary-foreground text-lg font-bold px-8 py-6 shadow-neon border-2 border-primary"
              >
                <Zap className="mr-2 h-5 w-5" />
                BORA METER GOL
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate("/dashboard")}
                className="text-foreground border-2 border-border hover:bg-card text-lg font-bold px-8 py-6"
              >
                DA UMA OLHADA
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<Target className="h-12 w-12 text-neon-cyan" />}
            title="PRECISÃO DE SNIPER"
            description="Previsão com dado real, estatística pesada e zero achismo. Aqui é raiz!"
          />
          <FeatureCard
            icon={<TrendingUp className="h-12 w-12 text-neon-green" />}
            title="ESCALAÇÃO NO AUTOMÁTICO"
            description="A IA monta teu time melhor que técnico da seleção. Sem choro, só porrada."
          />
          <FeatureCard
            icon={<Shield className="h-12 w-12 text-neon-red" />}
            title="ESTRATÉGIA MASTER"
            description="Tiro Curto, Liga Clássica, Valorização, Anti-manada. Tudo dominado."
          />
          <FeatureCard
            icon={<Zap className="h-12 w-12 text-neon-yellow" />}
            title="ALERTA NA HORA"
            description="Machucou? Banco? Oportunidade? Tu fica sabendo antes de geral."
          />
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="bg-card border-2 border-primary rounded-lg p-12 text-center space-y-6 shadow-neon">
          <h2 className="text-neon-cyan font-black uppercase">
            VAI FICAR AÍ DE FORA?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Enquanto tu fica no achismo, os caras da tua liga já tão usando isso aqui. Acorda pra vida!
          </p>
          <Button 
            size="lg"
            onClick={() => navigate("/auth")}
            className="bg-destructive hover:bg-destructive/80 text-destructive-foreground text-lg font-bold px-12 py-6 shadow-danger border-2 border-destructive"
          >
            <Target className="mr-2 h-5 w-5" />
            PARTIU DOMINAR
          </Button>
        </div>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => {
  return (
    <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-all duration-300 hover:shadow-neon">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-foreground mb-2 uppercase tracking-wide">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};

export default Landing;

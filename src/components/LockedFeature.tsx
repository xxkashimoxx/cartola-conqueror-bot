import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Plan = 'FREE' | 'PRO' | 'PREMIUM' | 'MASTER';

interface LockedFeatureProps {
  feature: string;
  currentPlan: Plan;
  requiredPlan: Plan;
  children?: React.ReactNode;
}

const planOrder: Record<Plan, number> = {
  FREE: 0,
  PRO: 1,
  PREMIUM: 2,
  MASTER: 3,
};

const planLabels: Record<Plan, string> = {
  FREE: 'Gratuito',
  PRO: 'Pro',
  PREMIUM: 'Premium',
  MASTER: 'Master',
};

export const canAccess = (currentPlan: Plan, requiredPlan: Plan): boolean => {
  return planOrder[currentPlan] >= planOrder[requiredPlan];
};

const LockedFeature = ({ feature, currentPlan, requiredPlan, children }: LockedFeatureProps) => {
  const hasAccess = canAccess(currentPlan, requiredPlan);

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <Card className="bg-card/50 border-2 border-dashed border-border">
      <CardContent className="p-8 text-center">
        <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-bold text-foreground mb-2">{feature}</h3>
        <p className="text-muted-foreground mb-4">
          Esta funcionalidade requer o plano <span className="text-primary font-bold">{planLabels[requiredPlan]}</span>
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Seu plano atual: <span className="font-semibold">{planLabels[currentPlan]}</span>
        </p>
        <Button className="bg-primary hover:bg-primary/80 shadow-neon">
          Fazer Upgrade
        </Button>
      </CardContent>
    </Card>
  );
};

export default LockedFeature;

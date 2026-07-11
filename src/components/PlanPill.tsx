import { cn } from "@/lib/utils";

type Plan = 'FREE' | 'PRO' | 'PREMIUM' | 'MASTER';

interface PlanPillProps {
  plan: Plan;
  className?: string;
}

const planConfig: Record<Plan, { bg: string; text: string; label: string }> = {
  FREE: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    label: 'Free',
  },
  PRO: {
    bg: 'bg-neon-cyan/20',
    text: 'text-neon-cyan',
    label: 'Pro',
  },
  PREMIUM: {
    bg: 'bg-neon-yellow/20',
    text: 'text-neon-yellow',
    label: 'Premium',
  },
  MASTER: {
    bg: 'bg-gradient-to-r from-neon-red/30 to-neon-cyan/30',
    text: 'text-foreground',
    label: 'Master',
  },
};

const PlanPill = (_props: PlanPillProps) => {
  // Planos desativados temporariamente.
  return null;
};

export default PlanPill;

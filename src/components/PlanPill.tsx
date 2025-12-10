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

const PlanPill = ({ plan, className }: PlanPillProps) => {
  const { bg, text, label } = planConfig[plan];

  return (
    <span className={cn(
      'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider',
      bg, text,
      className
    )}>
      {label}
    </span>
  );
};

export default PlanPill;

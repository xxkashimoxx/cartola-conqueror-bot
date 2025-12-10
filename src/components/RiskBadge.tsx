import { cn } from "@/lib/utils";

interface RiskBadgeProps {
  level: 'baixo' | 'medio' | 'alto';
  className?: string;
}

const RiskBadge = ({ level, className }: RiskBadgeProps) => {
  const config = {
    baixo: {
      bg: 'bg-neon-green/20',
      text: 'text-neon-green',
      border: 'border-neon-green/50',
      label: 'Baixo',
    },
    medio: {
      bg: 'bg-neon-yellow/20',
      text: 'text-neon-yellow',
      border: 'border-neon-yellow/50',
      label: 'Médio',
    },
    alto: {
      bg: 'bg-neon-red/20',
      text: 'text-neon-red',
      border: 'border-neon-red/50',
      label: 'Alto',
    },
  };

  const { bg, text, border, label } = config[level];

  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-xs font-bold border',
      bg, text, border,
      className
    )}>
      {label}
    </span>
  );
};

export default RiskBadge;

type Plan = 'FREE' | 'PRO' | 'PREMIUM' | 'MASTER';

interface LockedFeatureProps {
  feature?: string;
  currentPlan?: Plan;
  requiredPlan?: Plan;
  children?: React.ReactNode;
}

// Planos desativados temporariamente — todos os recursos liberados.
export const canAccess = (_currentPlan?: Plan, _requiredPlan?: Plan): boolean => true;

const LockedFeature = ({ children }: LockedFeatureProps) => <>{children}</>;

export default LockedFeature;

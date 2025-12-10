import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Plan = 'FREE' | 'PRO' | 'PREMIUM' | 'MASTER';

export const useUserPlan = () => {
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan>('FREE');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlan = async () => {
      if (!user) {
        setPlan('FREE');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('plan')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Erro ao buscar plano:', error);
          setPlan('FREE');
        } else {
          setPlan((data?.plan as Plan) || 'FREE');
        }
      } catch (err) {
        console.error('Erro em useUserPlan:', err);
        setPlan('FREE');
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [user]);

  return { plan, loading };
};

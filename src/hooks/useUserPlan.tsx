import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Plan = 'FREE' | 'PRO' | 'PREMIUM' | 'MASTER';

// Planos desativados temporariamente: todos os recursos liberados.
export const useUserPlan = () => {
  return { plan: 'MASTER' as Plan, loading: false };
};

-- Remover triggers temporariamente
DROP TRIGGER IF EXISTS update_clubes_updated_at ON public.clubes;
DROP TRIGGER IF EXISTS update_atletas_updated_at ON public.atletas;

-- Remover e recriar função com search_path correto
DROP FUNCTION IF EXISTS public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recriar triggers
CREATE TRIGGER update_clubes_updated_at
  BEFORE UPDATE ON public.clubes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_atletas_updated_at
  BEFORE UPDATE ON public.atletas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
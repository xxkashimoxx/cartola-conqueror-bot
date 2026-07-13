-- Cache por rodada para rotas de previsões
CREATE TABLE public.predictions_cache (
  cache_key text NOT NULL,
  rodada integer NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  ttl_seconds integer NOT NULL DEFAULT 300,
  PRIMARY KEY (cache_key, rodada)
);

GRANT SELECT ON public.predictions_cache TO anon;
GRANT SELECT ON public.predictions_cache TO authenticated;
GRANT ALL ON public.predictions_cache TO service_role;

ALTER TABLE public.predictions_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "predictions_cache readable by everyone"
  ON public.predictions_cache
  FOR SELECT
  USING (true);

CREATE INDEX idx_predictions_cache_rodada ON public.predictions_cache(rodada);

-- Função que invalida o cache de uma rodada
CREATE OR REPLACE FUNCTION public.invalidate_predictions_cache(_rodada integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.predictions_cache WHERE rodada = _rodada;
$$;

-- Trigger: quando uma escalação de usuário muda, invalida cache da rodada
CREATE OR REPLACE FUNCTION public.trg_invalidate_predictions_on_escalacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_rodada integer;
BEGIN
  target_rodada := COALESCE(NEW.rodada, OLD.rodada);
  IF target_rodada IS NOT NULL THEN
    DELETE FROM public.predictions_cache WHERE rodada = target_rodada;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS invalidate_predictions_on_escalacao ON public.escalacoes_usuario;
CREATE TRIGGER invalidate_predictions_on_escalacao
AFTER INSERT OR UPDATE OR DELETE ON public.escalacoes_usuario
FOR EACH ROW
EXECUTE FUNCTION public.trg_invalidate_predictions_on_escalacao();
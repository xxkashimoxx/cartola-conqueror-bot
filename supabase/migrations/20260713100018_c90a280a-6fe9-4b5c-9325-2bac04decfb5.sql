REVOKE EXECUTE ON FUNCTION public.invalidate_predictions_cache(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_invalidate_predictions_on_escalacao() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_predictions_cache(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_invalidate_predictions_on_escalacao() TO service_role;
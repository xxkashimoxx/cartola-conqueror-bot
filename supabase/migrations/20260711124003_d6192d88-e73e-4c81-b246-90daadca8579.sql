
CREATE TABLE IF NOT EXISTS public.news_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  source_ok boolean NOT NULL DEFAULT true
);

GRANT SELECT ON public.news_cache TO anon, authenticated;
GRANT ALL ON public.news_cache TO service_role;

ALTER TABLE public.news_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cache de notícias é público para leitura"
  ON public.news_cache
  FOR SELECT
  USING (true);

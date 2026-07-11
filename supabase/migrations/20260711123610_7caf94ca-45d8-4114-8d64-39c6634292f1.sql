
-- Tabela de pontuações parciais/ao vivo dos atletas na rodada em andamento
CREATE TABLE IF NOT EXISTS public.atleta_parciais (
  atleta_id integer NOT NULL,
  rodada integer NOT NULL,
  pontos numeric NOT NULL DEFAULT 0,
  scout jsonb,
  jogou boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (atleta_id, rodada)
);

CREATE INDEX IF NOT EXISTS idx_atleta_parciais_rodada ON public.atleta_parciais (rodada);
CREATE INDEX IF NOT EXISTS idx_atleta_parciais_atualizado ON public.atleta_parciais (atualizado_em DESC);

GRANT SELECT ON public.atleta_parciais TO anon, authenticated;
GRANT ALL ON public.atleta_parciais TO service_role;

ALTER TABLE public.atleta_parciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parciais são públicas para leitura"
  ON public.atleta_parciais
  FOR SELECT
  USING (true);

-- Habilitar realtime para atualizações ao vivo
ALTER TABLE public.atleta_parciais REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.atleta_parciais;


CREATE TABLE public.escalacoes_usuario (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  rodada integer NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('minha','recomendada')),
  estrategia text,
  atleta_ids integer[] NOT NULL DEFAULT '{}',
  pontos_esperados numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX escalacoes_usuario_unico ON public.escalacoes_usuario (user_id, rodada, tipo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.escalacoes_usuario TO authenticated;
GRANT ALL ON public.escalacoes_usuario TO service_role;

ALTER TABLE public.escalacoes_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario gerencia suas escalacoes"
ON public.escalacoes_usuario FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_escalacoes_usuario_updated
BEFORE UPDATE ON public.escalacoes_usuario
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

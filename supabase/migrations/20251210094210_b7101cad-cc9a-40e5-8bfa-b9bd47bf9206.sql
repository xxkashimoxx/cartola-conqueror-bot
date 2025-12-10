-- Tabela de partidas/confrontos
CREATE TABLE public.partidas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rodada INTEGER NOT NULL,
  data_partida TIMESTAMP WITH TIME ZONE,
  time_casa_id INTEGER REFERENCES public.clubes(id),
  time_fora_id INTEGER REFERENCES public.clubes(id),
  clean_sheet_casa NUMERIC(3,2) DEFAULT 0.5,
  clean_sheet_fora NUMERIC(3,2) DEFAULT 0.5,
  xg_casa NUMERIC(4,2) DEFAULT 1.0,
  xg_fora NUMERIC(4,2) DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de ausências (lesões, suspensões, descanso)
CREATE TABLE public.ausencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  atleta_id INTEGER REFERENCES public.atletas(id) ON DELETE CASCADE,
  rodada INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('LESAO', 'SUSPENSAO', 'DESCANSO')),
  nota TEXT,
  probabilidade NUMERIC(3,2) DEFAULT 0.8,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de oportunidades
CREATE TABLE public.oportunidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  atleta_id INTEGER REFERENCES public.atletas(id) ON DELETE CASCADE,
  rodada INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('APOSTA_DA_RODADA', 'SUBESTIMADO', 'BARATO_EXPLOSAO')),
  nota TEXT,
  score NUMERIC(4,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de planos de usuário
CREATE TYPE public.user_plan AS ENUM ('FREE', 'PRO', 'PREMIUM', 'MASTER');

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan user_plan NOT NULL DEFAULT 'FREE';

-- Enable RLS
ALTER TABLE public.partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ausencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;

-- RLS: Partidas são públicas para leitura
CREATE POLICY "Partidas visíveis para todos" ON public.partidas
  FOR SELECT USING (true);

-- RLS: Ausências são públicas para leitura
CREATE POLICY "Ausências visíveis para todos" ON public.ausencias
  FOR SELECT USING (true);

-- RLS: Oportunidades são públicas para leitura
CREATE POLICY "Oportunidades visíveis para todos" ON public.oportunidades
  FOR SELECT USING (true);

-- Admins podem gerenciar tudo
CREATE POLICY "Admins podem inserir partidas" ON public.partidas
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar partidas" ON public.partidas
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar partidas" ON public.partidas
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem inserir ausencias" ON public.ausencias
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar ausencias" ON public.ausencias
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar ausencias" ON public.ausencias
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem inserir oportunidades" ON public.oportunidades
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar oportunidades" ON public.oportunidades
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar oportunidades" ON public.oportunidades
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers para updated_at
CREATE TRIGGER update_partidas_updated_at
  BEFORE UPDATE ON public.partidas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
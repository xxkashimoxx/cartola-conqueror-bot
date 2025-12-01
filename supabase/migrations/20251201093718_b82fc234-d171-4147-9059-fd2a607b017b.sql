-- Criar tabela de clubes
CREATE TABLE IF NOT EXISTS public.clubes (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  abreviacao TEXT NOT NULL,
  escudo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de posições
CREATE TABLE IF NOT EXISTS public.posicoes (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  abreviacao TEXT NOT NULL
);

-- Inserir posições padrão
INSERT INTO public.posicoes (id, nome, abreviacao) VALUES
  (1, 'Goleiro', 'gol'),
  (2, 'Lateral', 'lat'),
  (3, 'Zagueiro', 'zag'),
  (4, 'Meia', 'mei'),
  (5, 'Atacante', 'ata'),
  (6, 'Técnico', 'tec')
ON CONFLICT (id) DO NOTHING;

-- Criar tabela de atletas
CREATE TABLE IF NOT EXISTS public.atletas (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  apelido TEXT NOT NULL,
  clube_id INTEGER REFERENCES public.clubes(id),
  posicao_id INTEGER REFERENCES public.posicoes(id),
  preco DECIMAL(10,2),
  variacao_preco DECIMAL(10,2),
  media DECIMAL(10,2),
  jogos INTEGER DEFAULT 0,
  pontos_num DECIMAL(10,2),
  foto_url TEXT,
  status_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de status do mercado
CREATE TABLE IF NOT EXISTS public.mercado_status (
  id SERIAL PRIMARY KEY,
  rodada_atual INTEGER NOT NULL,
  status_mercado INTEGER NOT NULL,
  abertura TIMESTAMP WITH TIME ZONE,
  fechamento TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de pontuações dos atletas por rodada
CREATE TABLE IF NOT EXISTS public.atleta_pontuacoes (
  id SERIAL PRIMARY KEY,
  atleta_id INTEGER REFERENCES public.atletas(id),
  rodada INTEGER NOT NULL,
  pontos DECIMAL(10,2) NOT NULL,
  preco DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(atleta_id, rodada)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_atletas_clube_id ON public.atletas(clube_id);
CREATE INDEX IF NOT EXISTS idx_atletas_posicao_id ON public.atletas(posicao_id);
CREATE INDEX IF NOT EXISTS idx_atleta_pontuacoes_atleta_id ON public.atleta_pontuacoes(atleta_id);
CREATE INDEX IF NOT EXISTS idx_atleta_pontuacoes_rodada ON public.atleta_pontuacoes(rodada);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.clubes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atletas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercado_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atleta_pontuacoes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (leitura pública, apenas admin pode escrever)
CREATE POLICY "Clubes são visíveis para todos" ON public.clubes FOR SELECT USING (true);
CREATE POLICY "Posições são visíveis para todos" ON public.posicoes FOR SELECT USING (true);
CREATE POLICY "Atletas são visíveis para todos" ON public.atletas FOR SELECT USING (true);
CREATE POLICY "Status do mercado é visível para todos" ON public.mercado_status FOR SELECT USING (true);
CREATE POLICY "Pontuações são visíveis para todos" ON public.atleta_pontuacoes FOR SELECT USING (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at nos clubes
CREATE TRIGGER update_clubes_updated_at
  BEFORE UPDATE ON public.clubes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar updated_at nos atletas
CREATE TRIGGER update_atletas_updated_at
  BEFORE UPDATE ON public.atletas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
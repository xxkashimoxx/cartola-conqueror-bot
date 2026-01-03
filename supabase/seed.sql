-- ===========================================
-- SEED DATA - Cartola FC Analytics
-- Execute este arquivo quando o banco estiver disponível
-- ===========================================

-- 1. POSIÇÕES
INSERT INTO posicoes (id, nome, abreviacao) VALUES 
(1, 'Goleiro', 'GOL'),
(2, 'Lateral', 'LAT'),
(3, 'Zagueiro', 'ZAG'),
(4, 'Meia', 'MEI'),
(5, 'Atacante', 'ATA'),
(6, 'Técnico', 'TEC')
ON CONFLICT (id) DO NOTHING;

-- 2. CLUBES
INSERT INTO clubes (id, nome, abreviacao, escudo_url) VALUES 
(262, 'Flamengo', 'FLA', 'https://s.sde.globo.com/media/organizations/2019/02/04/Flamengo-2018.svg'),
(263, 'Botafogo', 'BOT', 'https://s.sde.globo.com/media/organizations/2018/03/11/botafogo.svg'),
(264, 'Corinthians', 'COR', 'https://s.sde.globo.com/media/organizations/2019/09/30/Corinthians.svg'),
(265, 'Bahia', 'BAH', 'https://s.sde.globo.com/media/organizations/2018/03/11/bahia.svg'),
(266, 'Fluminense', 'FLU', 'https://s.sde.globo.com/media/organizations/2018/03/11/fluminense.svg'),
(267, 'Vasco', 'VAS', 'https://s.sde.globo.com/media/organizations/2018/03/11/vasco.svg'),
(275, 'Palmeiras', 'PAL', 'https://s.sde.globo.com/media/organizations/2018/04/10/Palmeiras.svg'),
(276, 'São Paulo', 'SAO', 'https://s.sde.globo.com/media/organizations/2019/02/04/Sao-Paulo-2019.svg'),
(277, 'Santos', 'SAN', 'https://s.sde.globo.com/media/organizations/2018/03/11/santos.svg'),
(280, 'Bragantino', 'BGT', 'https://s.sde.globo.com/media/organizations/2020/01/15/bragantino.svg'),
(282, 'Atlético-MG', 'CAM', 'https://s.sde.globo.com/media/organizations/2018/03/11/atletico-mg.svg'),
(283, 'Cruzeiro', 'CRU', 'https://s.sde.globo.com/media/organizations/2018/03/11/cruzeiro.svg'),
(284, 'Grêmio', 'GRE', 'https://s.sde.globo.com/media/organizations/2018/03/11/gremio.svg'),
(285, 'Internacional', 'INT', 'https://s.sde.globo.com/media/organizations/2018/03/11/internacional.svg'),
(286, 'Vitória', 'VIT', 'https://s.sde.globo.com/media/organizations/2018/03/11/Vitoria-BA.svg'),
(287, 'Athletico-PR', 'CAP', 'https://s.sde.globo.com/media/organizations/2021/04/13/athletico-pr.svg'),
(288, 'Sport', 'SPT', 'https://s.sde.globo.com/media/organizations/2018/03/11/sport.svg'),
(290, 'Goiás', 'GOI', 'https://s.sde.globo.com/media/organizations/2018/03/11/goias.svg'),
(292, 'Fortaleza', 'FOR', 'https://s.sde.globo.com/media/organizations/2018/03/12/fortaleza.svg'),
(293, 'Ceará', 'CEA', 'https://s.sde.globo.com/media/organizations/2018/03/12/ceara.svg')
ON CONFLICT (id) DO NOTHING;

-- 3. ATLETAS (Jogadores mock com dados realistas)
INSERT INTO atletas (id, nome, apelido, clube_id, posicao_id, preco, media, jogos, pontos_num, status_id, variacao_preco) VALUES 
-- Goleiros
(1001, 'Hugo Souza', 'Hugo Neneca', 264, 1, 8.50, 4.2, 15, 63.0, 7, 0.35),
(1002, 'Éverson', 'Éverson', 282, 1, 12.00, 5.8, 18, 104.4, 7, 0.80),
(1003, 'John', 'John', 263, 1, 10.50, 5.2, 16, 83.2, 7, -0.20),
(1004, 'Weverton', 'Weverton', 275, 1, 11.00, 4.9, 17, 83.3, 7, 0.15),

-- Laterais
(2001, 'Guilherme Arana', 'Arana', 282, 2, 14.00, 6.5, 16, 104.0, 7, 1.20),
(2002, 'Wesley', 'Wesley', 262, 2, 9.50, 4.8, 14, 67.2, 7, 0.40),
(2003, 'Marçal', 'Marçal', 263, 2, 7.00, 3.9, 12, 46.8, 7, -0.50),
(2004, 'Rafinha', 'Rafinha', 276, 2, 8.00, 4.2, 15, 63.0, 7, 0.10),

-- Zagueiros
(3001, 'Gustavo Gómez', 'Gómez', 275, 3, 13.00, 5.5, 17, 93.5, 7, 0.60),
(3002, 'Bastos', 'Bastos', 263, 3, 11.50, 5.0, 16, 80.0, 7, 0.30),
(3003, 'Léo Ortiz', 'Léo Ortiz', 262, 3, 12.00, 5.3, 15, 79.5, 7, 0.45),
(3004, 'Murillo', 'Murillo', 264, 3, 8.50, 4.1, 14, 57.4, 7, -0.25),

-- Meias
(4001, 'De Arrascaeta', 'Arrascaeta', 262, 4, 22.00, 8.5, 16, 136.0, 7, 2.50),
(4002, 'Raphael Veiga', 'Veiga', 275, 4, 18.50, 7.2, 17, 122.4, 7, 1.80),
(4003, 'Luiz Henrique', 'Luiz Henrique', 263, 4, 16.00, 6.8, 15, 102.0, 7, 1.50),
(4004, 'Oscar', 'Oscar', 276, 4, 15.00, 5.9, 14, 82.6, 7, 0.90),
(4005, 'Everton Ribeiro', 'E. Ribeiro', 265, 4, 12.00, 5.5, 16, 88.0, 7, 0.60),
(4006, 'Renato Augusto', 'Renato Augusto', 264, 4, 9.00, 4.0, 12, 48.0, 2, -0.80),

-- Atacantes
(5001, 'Pedro', 'Pedro', 262, 5, 25.00, 9.2, 17, 156.4, 7, 3.00),
(5002, 'Endrick', 'Endrick', 275, 5, 20.00, 7.8, 14, 109.2, 7, 2.20),
(5003, 'Tiquinho Soares', 'Tiquinho', 263, 5, 17.50, 6.9, 16, 110.4, 7, 1.40),
(5004, 'Yuri Alberto', 'Yuri Alberto', 264, 5, 14.00, 5.5, 15, 82.5, 7, 0.70),
(5005, 'Hulk', 'Hulk', 282, 5, 23.00, 8.8, 18, 158.4, 7, 2.80),
(5006, 'Luciano', 'Luciano', 276, 5, 16.00, 6.2, 16, 99.2, 7, 1.00),
(5007, 'Germán Cano', 'Cano', 266, 5, 13.00, 5.0, 14, 70.0, 2, -1.20),

-- Técnicos
(6001, 'Tite', 'Tite', 262, 6, 15.00, 5.5, 17, 93.5, 7, 0.50),
(6002, 'Abel Ferreira', 'Abel', 275, 6, 18.00, 6.8, 18, 122.4, 7, 1.20),
(6003, 'Artur Jorge', 'Artur Jorge', 263, 6, 16.50, 6.2, 16, 99.2, 7, 0.90)
ON CONFLICT (id) DO NOTHING;

-- 4. MERCADO STATUS
INSERT INTO mercado_status (id, rodada_atual, status_mercado, abertura, fechamento) VALUES 
(1, 15, 1, '2024-07-08T11:00:00Z', '2024-07-13T18:00:00Z')
ON CONFLICT (id) DO UPDATE SET 
  rodada_atual = EXCLUDED.rodada_atual,
  status_mercado = EXCLUDED.status_mercado,
  abertura = EXCLUDED.abertura,
  fechamento = EXCLUDED.fechamento;

-- 5. PARTIDAS (Rodada 15)
INSERT INTO partidas (id, rodada, time_casa_id, time_fora_id, data_partida, xg_casa, xg_fora, clean_sheet_casa, clean_sheet_fora) VALUES 
('p15-1', 15, 262, 267, '2024-07-13T16:00:00Z', 2.1, 0.8, 65, 25),
('p15-2', 15, 275, 264, '2024-07-13T18:30:00Z', 1.8, 1.2, 55, 35),
('p15-3', 15, 263, 265, '2024-07-13T21:00:00Z', 1.9, 1.0, 60, 30),
('p15-4', 15, 282, 266, '2024-07-14T16:00:00Z', 2.3, 0.9, 70, 20),
('p15-5', 15, 276, 284, '2024-07-14T18:30:00Z', 1.5, 1.4, 45, 40),
('p15-6', 15, 285, 287, '2024-07-14T21:00:00Z', 1.6, 1.3, 48, 38),
('p15-7', 15, 292, 283, '2024-07-15T19:00:00Z', 1.4, 1.1, 42, 35),
('p15-8', 15, 280, 286, '2024-07-15T21:30:00Z', 1.7, 0.7, 58, 22)
ON CONFLICT (id) DO NOTHING;

-- 6. AUSÊNCIAS (Lesões, Suspensões, Dúvidas)
INSERT INTO ausencias (id, atleta_id, rodada, tipo, probabilidade, nota) VALUES 
('aus-1', 4006, 15, 'LESAO', 100, 'Lesão muscular na coxa direita - previsão de 3 semanas'),
('aus-2', 5007, 15, 'LESAO', 100, 'Problema no tornozelo - fora por tempo indeterminado'),
('aus-3', 2003, 15, 'SUSPENSAO', 100, 'Suspensão automática por 3 cartões amarelos'),
('aus-4', 5004, 15, 'DUVIDA', 70, 'Sentiu desconforto muscular no treino - aguardando exames'),
('aus-5', 4004, 15, 'DUVIDA', 50, 'Gripe - deve se recuperar até o jogo'),
('aus-6', 3004, 15, 'DUVIDA', 60, 'Pancada no joelho - será reavaliado'),
('aus-7', 1003, 15, 'DUVIDA', 40, 'Descanso - pode ser poupado pelo técnico')
ON CONFLICT (id) DO NOTHING;

-- 7. OPORTUNIDADES
INSERT INTO oportunidades (id, atleta_id, rodada, tipo, score, nota) VALUES 
-- Apostas da Rodada (jogadores com bom momento e jogo favorável)
('op-1', 5001, 15, 'APOSTA', 92, 'Pedro em grande fase, 5 gols nos últimos 4 jogos. Flamengo joga em casa contra Vasco'),
('op-2', 4001, 15, 'APOSTA', 88, 'Arrascaeta com 3 assistências seguidas. Clássico em casa tende a valorizar'),
('op-3', 5005, 15, 'APOSTA', 85, 'Hulk é o artilheiro do campeonato. Atlético-MG favorito contra Fluminense'),
('op-4', 4003, 15, 'APOSTA', 82, 'Luiz Henrique desequilibrando. Botafogo líder jogando em casa'),

-- Subestimados (bom custo-benefício)
('op-5', 2001, 15, 'SUBESTIMADO', 78, 'Arana com média alta mas preço ainda acessível. Potencial de SG'),
('op-6', 4005, 15, 'SUBESTIMADO', 75, 'Everton Ribeiro consistente e preço caiu. Boa recuperação'),
('op-7', 5003, 15, 'SUBESTIMADO', 73, 'Tiquinho artilheiro do Botafogo. Preço não reflete qualidade'),
('op-8', 3001, 15, 'SUBESTIMADO', 70, 'Gómez sólido na defesa. Palmeiras deve buscar SG'),

-- Baratos com potencial de explosão
('op-9', 2002, 15, 'BARATO_EXPLOSAO', 68, 'Wesley barato e Flamengo deve golear. Pode pontuar bem'),
('op-10', 1001, 15, 'BARATO_EXPLOSAO', 65, 'Hugo Neneca titular barato. Corinthians pode surpreender'),
('op-11', 5006, 15, 'BARATO_EXPLOSAO', 63, 'Luciano com preço em baixa mas sempre decisivo em clássicos'),
('op-12', 3002, 15, 'BARATO_EXPLOSAO', 60, 'Bastos zagueiro barato do líder. Alta chance de SG')
ON CONFLICT (id) DO NOTHING;

-- 8. PONTUAÇÕES HISTÓRICAS (últimas rodadas de alguns jogadores)
INSERT INTO atleta_pontuacoes (atleta_id, rodada, pontos, preco) VALUES 
-- Pedro
(5001, 14, 15.5, 24.00),
(5001, 13, 8.2, 22.50),
(5001, 12, 12.0, 21.00),
(5001, 11, 3.5, 20.50),
-- Arrascaeta
(4001, 14, 11.0, 21.00),
(4001, 13, 9.5, 20.00),
(4001, 12, 6.0, 19.50),
(4001, 11, 13.2, 18.50),
-- Hulk
(5005, 14, 18.0, 22.00),
(5005, 13, 5.5, 21.50),
(5005, 12, 9.8, 20.50),
(5005, 11, 11.2, 19.50),
-- Luiz Henrique
(4003, 14, 8.5, 15.50),
(4003, 13, 10.2, 14.50),
(4003, 12, 7.0, 14.00),
(4003, 11, 5.5, 13.50)
ON CONFLICT DO NOTHING;

-- ===========================================
-- FIM DO SEED
-- ===========================================

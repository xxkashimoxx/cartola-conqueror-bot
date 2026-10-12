-- Preserve older saved teams with an empty bench.
alter table public.escalacoes_usuario
  add column if not exists reservas_ids integer[] not null default '{}'::integer[];

-- Retain the official participation flag alongside archived round scores.
alter table public.atleta_pontuacoes
  add column if not exists jogou boolean;

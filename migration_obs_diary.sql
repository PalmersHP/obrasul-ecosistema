-- Migration: adiciona colunas faltantes em obs_diary
ALTER TABLE public.obs_diary
  ADD COLUMN IF NOT EXISTS lider           text default '',
  ADD COLUMN IF NOT EXISTS local_obra      text default '',
  ADD COLUMN IF NOT EXISTS equipamentos    text default '',
  ADD COLUMN IF NOT EXISTS pendencias      text default '',
  ADD COLUMN IF NOT EXISTS riscos          text default '',
  ADD COLUMN IF NOT EXISTS programacao     text default '',
  ADD COLUMN IF NOT EXISTS finalizado      boolean default false;

-- Corrige constraint de clima para incluir 'parcialmente_nublado'
ALTER TABLE public.obs_diary DROP CONSTRAINT IF EXISTS obs_diary_clima_check;
ALTER TABLE public.obs_diary
  ADD CONSTRAINT obs_diary_clima_check
  CHECK (clima IN ('sol','parcialmente_nublado','nublado','chuva','chuva_forte'));

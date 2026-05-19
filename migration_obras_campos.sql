-- ============================================================
-- MIGRATION: Campos responsavel e lider em obs_projects
-- Rodar no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.obs_projects
  ADD COLUMN IF NOT EXISTS responsavel text DEFAULT '',
  ADD COLUMN IF NOT EXISTS lider       text DEFAULT '';

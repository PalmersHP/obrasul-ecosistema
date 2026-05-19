-- ============================================================
-- MIGRATION: Integração Equipe ↔ Obras
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- 1. obs_employees: colunas de alocação por obra
ALTER TABLE public.obs_employees
  ADD COLUMN IF NOT EXISTS project_id       uuid REFERENCES public.obs_projects ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_inicio      date,
  ADD COLUMN IF NOT EXISTS data_fim_previsto date,
  ADD COLUMN IF NOT EXISTS horas_dia        int DEFAULT 8,
  ADD COLUMN IF NOT EXISTS horas_dia_padrao int DEFAULT 8,
  ADD COLUMN IF NOT EXISTS valor_hora       numeric(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_obs_employees_project ON public.obs_employees(project_id);
CREATE INDEX IF NOT EXISTS idx_obs_employees_ativo   ON public.obs_employees(ativo);

-- 2. obs_presencas: colunas de horas (usadas pelo módulo Equipe)
ALTER TABLE public.obs_presencas
  ADD COLUMN IF NOT EXISTS horas_trabalhadas numeric(4,1) DEFAULT 8,
  ADD COLUMN IF NOT EXISTS horas_extra       numeric(4,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS project_id_obra   uuid REFERENCES public.obs_projects ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_obs_presencas_emp  ON public.obs_presencas(employee_id);
CREATE INDEX IF NOT EXISTS idx_obs_presencas_obra ON public.obs_presencas(project_id_obra);

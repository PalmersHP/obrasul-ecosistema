-- ============================================================
-- MIGRATION: Corrige schema do módulo Obras
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- 1. obs_employees: adiciona campos de alocação por obra
ALTER TABLE public.obs_employees
  ADD COLUMN IF NOT EXISTS project_id      uuid references public.obs_projects on delete set null,
  ADD COLUMN IF NOT EXISTS data_inicio     date,
  ADD COLUMN IF NOT EXISTS data_fim_prev   date,
  ADD COLUMN IF NOT EXISTS horas_dia       int default 8;

CREATE INDEX IF NOT EXISTS idx_obs_employees_project ON public.obs_employees(project_id);

-- 2. obs_checklists: adiciona campos para itens de qualidade individuais
ALTER TABLE public.obs_checklists
  ADD COLUMN IF NOT EXISTS item        text default '',
  ADD COLUMN IF NOT EXISTS etapa       text default '',
  ADD COLUMN IF NOT EXISTS concluido   boolean default false,
  ADD COLUMN IF NOT EXISTS created_by  uuid references public.obs_perfis on delete set null;

-- 3. obs_pendencias: tabela dedicada para pendências de obra
CREATE TABLE IF NOT EXISTS public.obs_pendencias (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.obs_projects on delete cascade not null,
  descricao   text not null,
  tipo        text default 'interna' check (tipo in ('interna','condominio','fornecedor')),
  prioridade  text default 'media'   check (prioridade in ('baixa','media','alta','critica')),
  responsavel text default '',
  prazo       date,
  concluido   boolean default false,
  created_by  uuid references public.obs_perfis on delete set null,
  created_at  timestamptz default now()
);
ALTER TABLE public.obs_pendencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "obs_pendencias_auth" ON public.obs_pendencias
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 4. obs_aditivos: tabela para aditivos contratuais
CREATE TABLE IF NOT EXISTS public.obs_aditivos (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid references public.obs_projects on delete cascade not null,
  numero           text default '',
  data_solicitacao date,
  data_aprovacao   date,
  motivo           text not null,
  descricao        text default '',
  valor            numeric(12,2) default 0,
  prazo_dias       int default 0,
  responsavel      text default '',
  observacoes      text default '',
  status           text default 'pendente'
                   check (status in ('pendente','aprovado_interno','aprovado_cliente','recusado')),
  created_at       timestamptz default now()
);
ALTER TABLE public.obs_aditivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "obs_aditivos_auth" ON public.obs_aditivos
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

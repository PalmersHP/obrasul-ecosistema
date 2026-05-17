-- ============================================================
-- MIGRATION: Multi-Tenancy por Unidades
-- Ecossistema Obrasul
-- Rodar no SQL Editor do Supabase — jmjbdundgbbefvhvyffb
-- ============================================================

-- ── PASSO 1: Criar tabela obs_unidades ───────────────────────
create table if not exists public.obs_unidades (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  slug       text not null unique,
  cnpj       text default '',
  cidade     text default '',
  estado     text default '',
  telefone   text default '',
  email      text default '',
  ativo      boolean default true,
  created_at timestamptz default now()
);
alter table public.obs_unidades enable row level security;

-- ── PASSO 2: Adicionar unidade_id em obs_perfis PRIMEIRO ─────
-- (as funções abaixo referenciam esta coluna — precisa existir antes)
alter table public.obs_perfis
  add column if not exists unidade_id uuid references public.obs_unidades on delete set null;

-- Atualizar constraint do role para incluir superadmin
alter table public.obs_perfis drop constraint if exists obs_perfis_role_check;
alter table public.obs_perfis
  add constraint obs_perfis_role_check
  check (role in ('superadmin','proprietario','gestor','financeiro','engenheiro','encarregado','orcamentista','vendedor'));

-- ── PASSO 3: Funções auxiliares ──────────────────────────────

-- Retorna unidade_id do usuário logado
create or replace function public.obs_get_unidade_id()
returns uuid language sql security definer stable as $$
  select unidade_id from public.obs_perfis where id = auth.uid()
$$;

-- True se o usuário for superadmin
create or replace function public.obs_is_superadmin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select role = 'superadmin' from public.obs_perfis where id = auth.uid()),
    false
  )
$$;

-- Atualizar obs_is_admin para incluir superadmin
create or replace function public.obs_is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select role in ('superadmin','proprietario','gestor') from public.obs_perfis where id = auth.uid()),
    false
  )
$$;

-- ── PASSO 4: Criar unidade padrão e migrar dados ──────────────
insert into public.obs_unidades (nome, slug, cidade, estado)
values ('Obrasul', 'obrasul', 'Florianópolis', 'SC')
on conflict (slug) do nothing;

-- Atribuir todos os usuários (não-superadmin) à unidade padrão
update public.obs_perfis
set unidade_id = (select id from public.obs_unidades where slug = 'obrasul')
where unidade_id is null and role != 'superadmin';

-- ── PASSO 5: Adicionar unidade_id nas tabelas de dados ────────

alter table public.obs_clients
  add column if not exists unidade_id uuid references public.obs_unidades on delete cascade;
update public.obs_clients set unidade_id = (select id from public.obs_unidades where slug = 'obrasul') where unidade_id is null;
alter table public.obs_clients alter column unidade_id set not null;

alter table public.obs_projects
  add column if not exists unidade_id uuid references public.obs_unidades on delete cascade;
update public.obs_projects set unidade_id = (select id from public.obs_unidades where slug = 'obrasul') where unidade_id is null;
alter table public.obs_projects alter column unidade_id set not null;

alter table public.obs_suppliers
  add column if not exists unidade_id uuid references public.obs_unidades on delete cascade;
update public.obs_suppliers set unidade_id = (select id from public.obs_unidades where slug = 'obrasul') where unidade_id is null;
alter table public.obs_suppliers alter column unidade_id set not null;

alter table public.obs_bank_accounts
  add column if not exists unidade_id uuid references public.obs_unidades on delete cascade;
update public.obs_bank_accounts set unidade_id = (select id from public.obs_unidades where slug = 'obrasul') where unidade_id is null;
alter table public.obs_bank_accounts alter column unidade_id set not null;

alter table public.obs_categories
  add column if not exists unidade_id uuid references public.obs_unidades on delete cascade;
update public.obs_categories set unidade_id = (select id from public.obs_unidades where slug = 'obrasul') where unidade_id is null;
alter table public.obs_categories alter column unidade_id set not null;

alter table public.obs_payables
  add column if not exists unidade_id uuid references public.obs_unidades on delete cascade;
update public.obs_payables set unidade_id = (select id from public.obs_unidades where slug = 'obrasul') where unidade_id is null;
alter table public.obs_payables alter column unidade_id set not null;

alter table public.obs_receivables
  add column if not exists unidade_id uuid references public.obs_unidades on delete cascade;
update public.obs_receivables set unidade_id = (select id from public.obs_unidades where slug = 'obrasul') where unidade_id is null;
alter table public.obs_receivables alter column unidade_id set not null;

alter table public.obs_purchase_requests
  add column if not exists unidade_id uuid references public.obs_unidades on delete cascade;
update public.obs_purchase_requests set unidade_id = (select id from public.obs_unidades where slug = 'obrasul') where unidade_id is null;
alter table public.obs_purchase_requests alter column unidade_id set not null;

alter table public.obs_employees
  add column if not exists unidade_id uuid references public.obs_unidades on delete cascade;
update public.obs_employees set unidade_id = (select id from public.obs_unidades where slug = 'obrasul') where unidade_id is null;
alter table public.obs_employees alter column unidade_id set not null;

alter table public.obs_stock
  add column if not exists unidade_id uuid references public.obs_unidades on delete cascade;
update public.obs_stock set unidade_id = (select id from public.obs_unidades where slug = 'obrasul') where unidade_id is null;
alter table public.obs_stock alter column unidade_id set not null;

alter table public.obs_contracts
  add column if not exists unidade_id uuid references public.obs_unidades on delete cascade;
update public.obs_contracts set unidade_id = (select id from public.obs_unidades where slug = 'obrasul') where unidade_id is null;
alter table public.obs_contracts alter column unidade_id set not null;

alter table public.obs_aditivos
  add column if not exists unidade_id uuid references public.obs_unidades on delete cascade;
update public.obs_aditivos set unidade_id = (select id from public.obs_unidades where slug = 'obrasul') where unidade_id is null;
alter table public.obs_aditivos alter column unidade_id set not null;

alter table public.obs_audit_logs
  add column if not exists unidade_id uuid references public.obs_unidades on delete set null;
update public.obs_audit_logs set unidade_id = (select id from public.obs_unidades where slug = 'obrasul') where unidade_id is null;

-- obs_configuracoes: mudar PK para (chave, unidade_id)
alter table public.obs_configuracoes
  add column if not exists unidade_id uuid references public.obs_unidades on delete cascade;
update public.obs_configuracoes
  set unidade_id = (select id from public.obs_unidades where slug = 'obrasul')
  where unidade_id is null;
alter table public.obs_configuracoes drop constraint if exists obs_configuracoes_pkey;
alter table public.obs_configuracoes add primary key (chave, unidade_id);

-- ── PASSO 6: Trigger para auto-fill unidade_id nos inserts ───
create or replace function public.obs_fill_unidade_id()
returns trigger language plpgsql security definer as $$
begin
  if new.unidade_id is null then
    new.unidade_id := public.obs_get_unidade_id();
  end if;
  return new;
end;
$$;

do $$
declare
  tbls text[] := array[
    'obs_clients','obs_projects','obs_suppliers','obs_bank_accounts',
    'obs_categories','obs_payables','obs_receivables','obs_purchase_requests',
    'obs_employees','obs_stock','obs_contracts','obs_aditivos'
  ];
  t text;
begin
  foreach t in array tbls loop
    execute format('drop trigger if exists trg_%I_fill_unidade on public.%I', t, t);
    execute format(
      'create trigger trg_%I_fill_unidade before insert on public.%I for each row execute function public.obs_fill_unidade_id()',
      t, t
    );
  end loop;
end;
$$;

-- ── PASSO 7: Reescrever RLS ──────────────────────────────────

-- obs_unidades: qualquer autenticado lê, só superadmin escreve
drop policy if exists "obs_unidades_read"  on public.obs_unidades;
drop policy if exists "obs_unidades_write" on public.obs_unidades;
create policy "obs_unidades_read"  on public.obs_unidades
  for select using (auth.uid() is not null);
create policy "obs_unidades_write" on public.obs_unidades
  for all using (public.obs_is_superadmin())
  with check (public.obs_is_superadmin());

-- obs_perfis
drop policy if exists "obs_perfis_own"          on public.obs_perfis;
drop policy if exists "obs_perfis_admin_read"   on public.obs_perfis;
drop policy if exists "obs_perfis_admin_insert" on public.obs_perfis;
drop policy if exists "obs_perfis_admin_update" on public.obs_perfis;

create policy "obs_perfis_own" on public.obs_perfis
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "obs_perfis_read_unit" on public.obs_perfis
  for select using (
    public.obs_is_superadmin()
    OR unidade_id = public.obs_get_unidade_id()
  );

create policy "obs_perfis_insert" on public.obs_perfis
  for insert with check (
    public.obs_is_superadmin()
    OR (public.obs_is_admin() AND unidade_id = public.obs_get_unidade_id())
  );

create policy "obs_perfis_update" on public.obs_perfis
  for update using (
    public.obs_is_superadmin()
    OR (public.obs_is_admin() AND unidade_id = public.obs_get_unidade_id())
  );

-- Tabelas top-level: superadmin vê tudo, usuário vê só sua unidade
do $$
declare
  tbl_policy text[][] := array[
    array['obs_clients',          'obs_clients_auth'],
    array['obs_projects',         'obs_projects_auth'],
    array['obs_suppliers',        'obs_suppliers_auth'],
    array['obs_bank_accounts',    'obs_bank_auth'],
    array['obs_categories',       'obs_categories_auth'],
    array['obs_payables',         'obs_payables_auth'],
    array['obs_receivables',      'obs_receivables_auth'],
    array['obs_purchase_requests','obs_purchase_auth'],
    array['obs_employees',        'obs_employees_auth'],
    array['obs_stock',            'obs_stock_auth'],
    array['obs_contracts',        'obs_contracts_auth'],
    array['obs_aditivos',         'obs_aditivos_auth']
  ];
  row text[];
begin
  foreach row slice 1 in array tbl_policy loop
    execute format('drop policy if exists %I on public.%I', row[2], row[1]);
    execute format(
      'create policy %I on public.%I for all using (public.obs_is_superadmin() OR unidade_id = public.obs_get_unidade_id()) with check (public.obs_is_superadmin() OR unidade_id = public.obs_get_unidade_id())',
      row[2], row[1]
    );
  end loop;
end;
$$;

-- obs_configuracoes
drop policy if exists "obs_config_auth" on public.obs_configuracoes;
create policy "obs_config_auth" on public.obs_configuracoes
  for all using (public.obs_is_superadmin() OR unidade_id = public.obs_get_unidade_id())
  with check (public.obs_is_superadmin() OR unidade_id = public.obs_get_unidade_id());

-- obs_audit_logs
drop policy if exists "obs_audit_read"   on public.obs_audit_logs;
drop policy if exists "obs_audit_insert" on public.obs_audit_logs;
drop policy if exists "obs_audit_auth"   on public.obs_audit_logs;
create policy "obs_audit_read" on public.obs_audit_logs
  for select using (public.obs_is_superadmin() OR unidade_id = public.obs_get_unidade_id());
create policy "obs_audit_insert" on public.obs_audit_logs
  for insert with check (auth.uid() is not null);

-- Tabelas filho: RLS via join na tabela pai (obs_projects)
drop policy if exists "obs_stages_auth"       on public.obs_project_stages;
drop policy if exists "obs_diary_auth"        on public.obs_diary;
drop policy if exists "obs_photos_auth"       on public.obs_photos;
drop policy if exists "obs_checklists_auth"   on public.obs_checklists;
drop policy if exists "obs_cronograma_auth"   on public.obs_cronograma;
drop policy if exists "obs_documents_auth"    on public.obs_documents;
drop policy if exists "obs_portal_tokens_auth" on public.obs_portal_tokens;
drop policy if exists "obs_comunicados_auth"  on public.obs_comunicados;
drop policy if exists "obs_comunicados_anon_r" on public.obs_comunicados;
drop policy if exists "obs_comunicados_anon_w" on public.obs_comunicados;
drop policy if exists "obs_garantias_auth"    on public.obs_garantias;
drop policy if exists "obs_stock_mov_auth"    on public.obs_stock_movimentos;
drop policy if exists "obs_presencas_auth"    on public.obs_presencas;

create policy "obs_stages_auth" on public.obs_project_stages for all using (
  exists (select 1 from public.obs_projects p where p.id = project_id
    and (public.obs_is_superadmin() or p.unidade_id = public.obs_get_unidade_id()))
);
create policy "obs_diary_auth" on public.obs_diary for all using (
  exists (select 1 from public.obs_projects p where p.id = project_id
    and (public.obs_is_superadmin() or p.unidade_id = public.obs_get_unidade_id()))
);
create policy "obs_photos_auth" on public.obs_photos for all using (
  exists (select 1 from public.obs_projects p where p.id = project_id
    and (public.obs_is_superadmin() or p.unidade_id = public.obs_get_unidade_id()))
);
create policy "obs_checklists_auth" on public.obs_checklists for all using (
  exists (select 1 from public.obs_projects p where p.id = project_id
    and (public.obs_is_superadmin() or p.unidade_id = public.obs_get_unidade_id()))
);
create policy "obs_cronograma_auth" on public.obs_cronograma for all using (
  exists (select 1 from public.obs_projects p where p.id = project_id
    and (public.obs_is_superadmin() or p.unidade_id = public.obs_get_unidade_id()))
);
create policy "obs_documents_auth" on public.obs_documents for all using (
  exists (select 1 from public.obs_projects p where p.id = project_id
    and (public.obs_is_superadmin() or p.unidade_id = public.obs_get_unidade_id()))
);
create policy "obs_portal_tokens_auth" on public.obs_portal_tokens for all using (
  exists (select 1 from public.obs_projects p where p.id = project_id
    and (public.obs_is_superadmin() or p.unidade_id = public.obs_get_unidade_id()))
);
create policy "obs_comunicados_auth" on public.obs_comunicados for all using (
  exists (select 1 from public.obs_projects p where p.id = project_id
    and (public.obs_is_superadmin() or p.unidade_id = public.obs_get_unidade_id()))
);
create policy "obs_comunicados_anon_r" on public.obs_comunicados for select using (true);
create policy "obs_comunicados_anon_w" on public.obs_comunicados for insert with check (remetente = 'sindico');
create policy "obs_garantias_auth" on public.obs_garantias for all using (
  exists (select 1 from public.obs_projects p where p.id = project_id
    and (public.obs_is_superadmin() or p.unidade_id = public.obs_get_unidade_id()))
);
create policy "obs_stock_mov_auth" on public.obs_stock_movimentos for all using (
  exists (select 1 from public.obs_stock s where s.id = stock_id
    and (public.obs_is_superadmin() or s.unidade_id = public.obs_get_unidade_id()))
);
create policy "obs_presencas_auth" on public.obs_presencas for all using (
  exists (select 1 from public.obs_employees e where e.id = employee_id
    and (public.obs_is_superadmin() or e.unidade_id = public.obs_get_unidade_id()))
);

-- obs_type_stages: global, sem isolamento por unidade
-- Mantém a policy existente (qualquer autenticado lê/escreve)

-- ── PRONTO ───────────────────────────────────────────────────
-- 1. Unidade padrão "obrasul" criada e todos os dados migrados
-- 2. Superadmin: crie um usuário com role='superadmin' e unidade_id=null
--    no Supabase Auth + obs_perfis manualmente ou via service_role
-- 3. No frontend, acesse ?unit=admin para o painel do superadmin
--    e ?unit=obrasul para o painel da unidade padrão

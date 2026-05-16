-- ============================================================
-- ECOSSISTEMA OBRASUL — Setup Supabase
-- Projeto: jmjbdundgbbefvhvyffb
-- Rodar no SQL Editor do Supabase (Dashboard → SQL Editor → New query)
-- ============================================================

-- ── 1. PERFIS DE USUÁRIOS ────────────────────────────────────
create table if not exists public.obs_perfis (
  id         uuid references auth.users on delete cascade primary key,
  nome       text not null default '',
  email      text not null default '',
  cargo      text default '',
  role       text not null default 'engenheiro'
             check (role in ('proprietario','gestor','financeiro','engenheiro','encarregado','orcamentista','vendedor')),
  ativo      boolean default true,
  created_at timestamptz default now()
);
alter table public.obs_perfis enable row level security;

-- Função: é proprietário ou gestor?
create or replace function public.obs_is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select role in ('proprietario','gestor') from public.obs_perfis where id = auth.uid()),
    false
  )
$$;

-- Função: existe algum proprietário?
create or replace function public.obs_has_owner()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.obs_perfis where role = 'proprietario')
$$;

-- RLS perfis
create policy "obs_perfis_own"          on public.obs_perfis for all    using (auth.uid() = id) with check (auth.uid() = id);
create policy "obs_perfis_admin_read"   on public.obs_perfis for select using (public.obs_is_admin());
create policy "obs_perfis_admin_insert" on public.obs_perfis for insert with check (public.obs_is_admin());
create policy "obs_perfis_admin_update" on public.obs_perfis for update using (public.obs_is_admin());

-- ── 2. CLIENTES (CONDOMÍNIOS) ─────────────────────────────────
create table if not exists public.obs_clients (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  tipo             text default 'condominio' check (tipo in ('condominio','pessoa_fisica','pessoa_juridica')),
  cnpj             text default '',
  sindico_nome     text default '',
  sindico_email    text default '',
  sindico_telefone text default '',
  administradora   text default '',
  endereco         text default '',
  cidade           text default '',
  estado           text default '',
  cep              text default '',
  andares          int default 0,
  unidades         int default 0,
  tipo_servico     text default '',   -- interesse comercial
  observacoes      text default '',
  ativo            boolean default true,
  created_at       timestamptz default now()
);
alter table public.obs_clients enable row level security;
create policy "obs_clients_auth" on public.obs_clients for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 3. OBRAS ─────────────────────────────────────────────────
create table if not exists public.obs_projects (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  client_id        uuid references public.obs_clients on delete set null,
  tipo_servico     text default 'fachada'
                   check (tipo_servico in ('fachada','impermeabilizacao_pilotis','impermeabilizacao_reservatorio','telhado','pintura_hall','pintura_area_comum','misto','outro')),
  status           text default 'prospeccao'
                   check (status in ('prospeccao','orcamento','aprovado','mobilizacao','em_execucao','vistoria','entregue','em_garantia','cancelado')),
  valor_contrato   numeric(12,2) default 0,
  valor_recebido   numeric(12,2) default 0,
  valor_custo      numeric(12,2) default 0,
  data_inicio      date,
  data_prev_fim    date,
  data_fim         date,
  andares          int default 0,
  area_m2          numeric(10,2) default 0,
  responsavel_id   uuid references public.obs_perfis on delete set null,
  encarregado_id   uuid references public.obs_perfis on delete set null,
  endereco         text default '',
  cidade           text default '',
  observacoes      text default '',
  orcamento_id     uuid,   -- vínculo com módulo de orçamentos (futuro)
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
alter table public.obs_projects enable row level security;
create policy "obs_projects_auth" on public.obs_projects for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 4. TEMPLATES DE ETAPAS POR TIPO DE SERVIÇO ───────────────
create table if not exists public.obs_type_stages (
  id               uuid primary key default gen_random_uuid(),
  tipo_servico     text not null,
  nome             text not null,
  ordem            int not null default 0,
  obrigatoria      boolean default false,
  bloqueante       boolean default false
);
alter table public.obs_type_stages enable row level security;
create policy "obs_type_stages_auth" on public.obs_type_stages for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 5. ETAPAS EFETIVAS DE CADA OBRA ──────────────────────────
create table if not exists public.obs_project_stages (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid references public.obs_projects on delete cascade not null,
  nome             text not null,
  ordem            int not null default 0,
  status           text default 'pendente' check (status in ('pendente','em_andamento','concluida','bloqueada')),
  obrigatoria      boolean default false,
  bloqueante       boolean default false,
  responsavel_id   uuid references public.obs_perfis on delete set null,
  data_prev        date,
  data_conclusao   date,
  perc_peso        numeric(5,2) default 0,  -- peso financeiro desta etapa (%)
  observacoes      text default ''
);
alter table public.obs_project_stages enable row level security;
create policy "obs_stages_auth" on public.obs_project_stages for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 6. DIÁRIO DE OBRA ─────────────────────────────────────────
create table if not exists public.obs_diary (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid references public.obs_projects on delete cascade not null,
  data                  date not null default current_date,
  autor_id              uuid references public.obs_perfis on delete set null,
  clima                 text default 'sol' check (clima in ('sol','nublado','chuva','chuva_forte')),
  trabalhadores         int default 0,
  atividades            text default '',
  ocorrencias           text default '',
  materiais_usados      text default '',
  checklist_seguranca   boolean default false,
  created_at            timestamptz default now()
);
alter table public.obs_diary enable row level security;
create policy "obs_diary_auth" on public.obs_diary for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 7. FOTOS DA OBRA ─────────────────────────────────────────
create table if not exists public.obs_photos (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.obs_projects on delete cascade not null,
  stage_id    uuid references public.obs_project_stages on delete set null,
  url         text not null,
  legenda     text default '',
  tipo        text default 'durante' check (tipo in ('antes','durante','depois','ocorrencia')),
  autor_id    uuid references public.obs_perfis on delete set null,
  created_at  timestamptz default now()
);
alter table public.obs_photos enable row level security;
create policy "obs_photos_auth" on public.obs_photos for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 8. CHECKLISTS ────────────────────────────────────────────
create table if not exists public.obs_checklists (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.obs_projects on delete cascade not null,
  tipo        text default 'seguranca' check (tipo in ('seguranca','qualidade','entrega')),
  data        date default current_date,
  autor_id    uuid references public.obs_perfis on delete set null,
  itens       jsonb default '[]',
  assinado    boolean default false,
  created_at  timestamptz default now()
);
alter table public.obs_checklists enable row level security;
create policy "obs_checklists_auth" on public.obs_checklists for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 9. FORNECEDORES ──────────────────────────────────────────
create table if not exists public.obs_suppliers (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  cnpj      text default '',
  categoria text default '',
  email     text default '',
  telefone  text default '',
  banco     text default '',
  agencia   text default '',
  conta     text default '',
  pix       text default '',
  endereco  text default '',
  ativo     boolean default true,
  created_at timestamptz default now()
);
alter table public.obs_suppliers enable row level security;
create policy "obs_suppliers_auth" on public.obs_suppliers for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 10. CONTAS BANCÁRIAS ──────────────────────────────────────
create table if not exists public.obs_bank_accounts (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  banco         text default '',
  agencia       text default '',
  conta_numero  text default '',
  tipo          text default 'corrente' check (tipo in ('corrente','poupanca','investimento')),
  saldo_atual   numeric(12,2) default 0,
  ativo         boolean default true,
  created_at    timestamptz default now()
);
alter table public.obs_bank_accounts enable row level security;
create policy "obs_bank_auth" on public.obs_bank_accounts for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 11. CATEGORIAS FINANCEIRAS ───────────────────────────────
create table if not exists public.obs_categories (
  id     uuid primary key default gen_random_uuid(),
  nome   text not null,
  tipo   text not null check (tipo in ('receita','despesa')),
  pai_id uuid references public.obs_categories on delete set null,
  ativo  boolean default true
);
alter table public.obs_categories enable row level security;
create policy "obs_categories_auth" on public.obs_categories for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 12. CONTAS A PAGAR ───────────────────────────────────────
create table if not exists public.obs_payables (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references public.obs_projects on delete set null,
  descricao       text not null,
  valor           numeric(12,2) not null default 0,
  data_vencimento date not null,
  data_pagamento  date,
  status          text default 'em_aberto' check (status in ('em_aberto','pago','cancelado','agendado')),
  tipo            text default 'material' check (tipo in ('material','servico','mao_de_obra','equipamento','administrativo','imposto','seguro','outro')),
  fornecedor_id   uuid references public.obs_suppliers on delete set null,
  categoria_id    uuid references public.obs_categories on delete set null,
  conta_id        uuid references public.obs_bank_accounts on delete set null,
  nf_numero       text default '',
  observacoes     text default '',
  created_by      uuid references public.obs_perfis on delete set null,
  created_at      timestamptz default now()
);
alter table public.obs_payables enable row level security;
create policy "obs_payables_auth" on public.obs_payables for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 13. CONTAS A RECEBER ─────────────────────────────────────
create table if not exists public.obs_receivables (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid references public.obs_projects on delete set null,
  client_id        uuid references public.obs_clients on delete set null,
  descricao        text not null,
  valor            numeric(12,2) not null default 0,
  data_vencimento  date not null,
  data_recebimento date,
  status           text default 'em_aberto' check (status in ('em_aberto','recebido','cancelado','atrasado')),
  tipo_recebimento text default 'parcela' check (tipo_recebimento in ('parcela','medicao','final','adiantamento','outro')),
  categoria_id     uuid references public.obs_categories on delete set null,
  conta_id         uuid references public.obs_bank_accounts on delete set null,
  observacoes      text default '',
  created_by       uuid references public.obs_perfis on delete set null,
  created_at       timestamptz default now()
);
alter table public.obs_receivables enable row level security;
create policy "obs_receivables_auth" on public.obs_receivables for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 14. SOLICITAÇÕES DE COMPRA ───────────────────────────────
create table if not exists public.obs_purchase_requests (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references public.obs_projects on delete set null,
  solicitante_id  uuid references public.obs_perfis on delete set null,
  descricao       text not null,
  valor_estimado  numeric(12,2) default 0,
  fornecedor_id   uuid references public.obs_suppliers on delete set null,
  status          text default 'solicitado' check (status in ('solicitado','aprovado','recusado','comprado')),
  tipo_material   text default '',
  urgencia        text default 'normal' check (urgencia in ('baixa','normal','alta','urgente')),
  observacoes     text default '',
  created_at      timestamptz default now()
);
alter table public.obs_purchase_requests enable row level security;
create policy "obs_purchase_auth" on public.obs_purchase_requests for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 15. FUNCIONÁRIOS ─────────────────────────────────────────
create table if not exists public.obs_employees (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  cpf            text default '',
  tipo_vinculo   text default 'clt' check (tipo_vinculo in ('clt','pj','diarista','estagio')),
  funcao         text default '',
  nivel          text default 'n1' check (nivel in ('n1','n2','n3','n4')),
  salario_base   numeric(10,2) default 0,
  data_admissao  date,
  email          text default '',
  telefone       text default '',
  banco          text default '',
  agencia        text default '',
  conta          text default '',
  pix            text default '',
  ativo          boolean default true,
  observacoes    text default '',
  created_at     timestamptz default now()
);
alter table public.obs_employees enable row level security;
create policy "obs_employees_auth" on public.obs_employees for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 16. CRONOGRAMA FÍSICO-FINANCEIRO ─────────────────────────
create table if not exists public.obs_cronograma (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid references public.obs_projects on delete cascade not null,
  periodo               text not null,
  data_inicio           date,
  data_fim              date,
  perc_fisico_prev      numeric(5,2) default 0,
  perc_fisico_real      numeric(5,2) default 0,
  valor_financeiro_prev numeric(12,2) default 0,
  valor_financeiro_real numeric(12,2) default 0,
  observacoes           text default '',
  ordem                 int default 0
);
alter table public.obs_cronograma enable row level security;
create policy "obs_cronograma_auth" on public.obs_cronograma for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 17. DOCUMENTOS ───────────────────────────────────────────
create table if not exists public.obs_documents (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid references public.obs_projects on delete cascade not null,
  nome             text not null,
  tipo             text default 'outro' check (tipo in ('contrato','art','orcamento_aprovado','laudo','as_built','seguro','outro')),
  url              text not null,
  visivel_sindico  boolean default true,
  autor_id         uuid references public.obs_perfis on delete set null,
  created_at       timestamptz default now()
);
alter table public.obs_documents enable row level security;
create policy "obs_documents_auth" on public.obs_documents for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 18. TOKENS DO PORTAL DO SÍNDICO ──────────────────────────
create table if not exists public.obs_portal_tokens (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid references public.obs_projects on delete cascade not null,
  client_id      uuid references public.obs_clients on delete set null,
  token          text unique not null default gen_random_uuid()::text,
  email_sindico  text default '',
  nome_sindico   text default '',
  ativo          boolean default true,
  expira_em      timestamptz,
  ultimo_acesso  timestamptz,
  created_at     timestamptz default now()
);
alter table public.obs_portal_tokens enable row level security;
-- Acesso interno (autenticado)
create policy "obs_portal_tokens_auth" on public.obs_portal_tokens for all using (auth.uid() is not null) with check (auth.uid() is not null);
-- Acesso anônimo pelo token (portal síndico)
create policy "obs_portal_tokens_anon" on public.obs_portal_tokens for select using (ativo = true);

-- ── 19. COMUNICADOS ──────────────────────────────────────────
create table if not exists public.obs_comunicados (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references public.obs_projects on delete cascade not null,
  remetente       text not null check (remetente in ('obrasul','sindico')),
  remetente_nome  text default '',
  mensagem        text not null,
  tipo            text default 'informativo' check (tipo in ('informativo','urgente','solicitacao','resposta')),
  lido            boolean default false,
  created_at      timestamptz default now()
);
alter table public.obs_comunicados enable row level security;
create policy "obs_comunicados_auth"    on public.obs_comunicados for all    using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "obs_comunicados_anon_r"  on public.obs_comunicados for select using (true);
create policy "obs_comunicados_anon_w"  on public.obs_comunicados for insert with check (remetente = 'sindico');

-- ── 20. AUDIT LOG ────────────────────────────────────────────
create table if not exists public.obs_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  usuario_id    uuid,
  usuario_nome  text default '',
  acao          text default '',
  tabela        text default '',
  registro_id   text default '',
  dados_antes   jsonb,
  dados_depois  jsonb,
  descricao     text default ''
);
alter table public.obs_audit_logs enable row level security;
create policy "obs_audit_read"   on public.obs_audit_logs for select using (auth.uid() is not null);
create policy "obs_audit_insert" on public.obs_audit_logs for insert with check (auth.uid() is not null);
-- Sem UPDATE nem DELETE no audit log

-- ── 21. TRIGGER updated_at ───────────────────────────────────
create or replace function public.obs_handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists obs_projects_updated_at on public.obs_projects;
create trigger obs_projects_updated_at
  before update on public.obs_projects
  for each row execute function public.obs_handle_updated_at();

-- ── 22. DADOS INICIAIS — Templates de etapas ─────────────────
insert into public.obs_type_stages (tipo_servico, nome, ordem, obrigatoria, bloqueante) values
-- Fachada
('fachada','Mobilização e documentação',1,true,true),
('fachada','Montagem de andaime/corda',2,true,false),
('fachada','Limpeza e hidrojateamento',3,true,false),
('fachada','Selagem de fissuras e trincas',4,false,false),
('fachada','Aplicação de fundo preparador',5,false,false),
('fachada','Pintura 1ª demão',6,true,false),
('fachada','Pintura 2ª demão',7,true,false),
('fachada','Revisão e retoques',8,false,false),
('fachada','Retirada de andaime e limpeza',9,true,false),
('fachada','Vistoria final',10,true,true),
-- Impermeabilização pilotis
('impermeabilizacao_pilotis','Demolição do piso existente',1,true,true),
('impermeabilizacao_pilotis','Tratamento estrutural',2,false,false),
('impermeabilizacao_pilotis','Aplicação de impermeabilizante',3,true,false),
('impermeabilizacao_pilotis','Contrapiso',4,true,false),
('impermeabilizacao_pilotis','Acabamento',5,false,false),
('impermeabilizacao_pilotis','Vistoria final',6,true,true),
-- Impermeabilização reservatório
('impermeabilizacao_reservatorio','Esvaziamento e limpeza',1,true,true),
('impermeabilizacao_reservatorio','Tratamento de fissuras',2,true,false),
('impermeabilizacao_reservatorio','Aplicação de impermeabilizante',3,true,false),
('impermeabilizacao_reservatorio','Teste de estanqueidade',4,true,true),
('impermeabilizacao_reservatorio','Enchimento e entrega',5,true,false),
-- Telhado
('telhado','Mobilização e segurança NR-35',1,true,true),
('telhado','Retirada das telhas antigas',2,true,false),
('telhado','Tratamento da estrutura',3,false,false),
('telhado','Instalação de manta/calha',4,false,false),
('telhado','Assentamento das telhas',5,true,false),
('telhado','Arremates e rufos',6,false,false),
('telhado','Limpeza e vistoria',7,true,true),
-- Pintura hall/área comum
('pintura_hall','Proteção de mobiliário e piso',1,true,false),
('pintura_hall','Preparação da superfície',2,true,false),
('pintura_hall','Massa corrida',3,false,false),
('pintura_hall','Pintura 1ª demão',4,true,false),
('pintura_hall','Pintura 2ª demão',5,true,false),
('pintura_hall','Limpeza final',6,true,false),
('pintura_hall','Vistoria',7,true,true)
on conflict do nothing;

-- ── 23. CATEGORIAS FINANCEIRAS INICIAIS ──────────────────────
insert into public.obs_categories (nome, tipo) values
('Materiais de obra','despesa'),
('Mão de obra','despesa'),
('Equipamentos e ferramentas','despesa'),
('EPIs e segurança','despesa'),
('Transporte e logística','despesa'),
('Alimentação e hospedagem','despesa'),
('ART e documentação','despesa'),
('Seguros','despesa'),
('Impostos','despesa'),
('Administrativo','despesa'),
('Parcela de contrato','receita'),
('Medição','receita'),
('Adiantamento','receita'),
('Entrega final','receita')
on conflict do nothing;

-- ============================================================
-- PRONTO! Próximos passos:
-- 1. Abra o hub (index.html) e crie o primeiro usuário (vira proprietário)
-- 2. Cadastre clientes/condomínios
-- 3. Inicie o primeiro orçamento
-- ============================================================

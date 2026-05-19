-- ============================================================
-- MIGRATION: Correções abrangentes — todas as tabelas
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- 1. obs_perfis: campos que os módulos esperam
ALTER TABLE public.obs_perfis
  ADD COLUMN IF NOT EXISTS nome_completo text DEFAULT '',
  ADD COLUMN IF NOT EXISTS telefone      text DEFAULT '';

-- 2. obs_purchase_requests: expande status para o fluxo completo
ALTER TABLE public.obs_purchase_requests
  DROP CONSTRAINT IF EXISTS obs_purchase_requests_status_check;
ALTER TABLE public.obs_purchase_requests
  ADD CONSTRAINT obs_purchase_requests_status_check
  CHECK (status IN ('solicitado','em_analise','em_cotacao','aprovado','comprado','entregue','cancelado'));

-- 3. obs_payables: novos campos textuais + expande status
ALTER TABLE public.obs_payables
  ADD COLUMN IF NOT EXISTS fornecedor_nome       text DEFAULT '',
  ADD COLUMN IF NOT EXISTS categoria_nome        text DEFAULT '',
  ADD COLUMN IF NOT EXISTS forma_pagamento       text DEFAULT '',
  ADD COLUMN IF NOT EXISTS responsavel_aprovacao text DEFAULT '',
  ADD COLUMN IF NOT EXISTS valor_pago            numeric(12,2) DEFAULT 0;

ALTER TABLE public.obs_payables
  DROP CONSTRAINT IF EXISTS obs_payables_status_check;
ALTER TABLE public.obs_payables
  ADD CONSTRAINT obs_payables_status_check
  CHECK (status IN ('em_aberto','pago','cancelado','agendado','previsto','aprovado','atrasado'));

-- 4. obs_receivables: novos campos + expande status
ALTER TABLE public.obs_receivables
  ADD COLUMN IF NOT EXISTS numero_parcela  int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS forma_pagamento text DEFAULT '',
  ADD COLUMN IF NOT EXISTS comprovante     text DEFAULT '',
  ADD COLUMN IF NOT EXISTS valor_recebido  numeric(12,2) DEFAULT 0;

ALTER TABLE public.obs_receivables
  DROP CONSTRAINT IF EXISTS obs_receivables_status_check;
ALTER TABLE public.obs_receivables
  ADD CONSTRAINT obs_receivables_status_check
  CHECK (status IN ('em_aberto','recebido','cancelado','atrasado','previsto','parcial','renegociado'));

-- 5. obs_garantias: expande status para o fluxo de chamados
ALTER TABLE public.obs_garantias
  DROP CONSTRAINT IF EXISTS obs_garantias_status_check;
ALTER TABLE public.obs_garantias
  ADD CONSTRAINT obs_garantias_status_check
  CHECK (status IN ('aberto','em_atendimento','aguardando_material','resolvido','cancelado',
                    'recebido','analise','vistoria','procedente','improcedente','em_execucao','encerrado'));

-- 6. obs_stock_movimentos: campos de transferência + tipo expandido
ALTER TABLE public.obs_stock_movimentos
  ADD COLUMN IF NOT EXISTS origem  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS destino text DEFAULT '';

ALTER TABLE public.obs_stock_movimentos
  DROP CONSTRAINT IF EXISTS obs_stock_movimentos_tipo_check;
ALTER TABLE public.obs_stock_movimentos
  ADD CONSTRAINT obs_stock_movimentos_tipo_check
  CHECK (tipo IN ('entrada','saida','ajuste','transferencia'));

-- 7. obs_clients: campos de endereço e condomínio
ALTER TABLE public.obs_clients
  ADD COLUMN IF NOT EXISTS torres int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vagas  int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bairro text DEFAULT '';

-- 8. obs_employees: campos do módulo Equipe
ALTER TABLE public.obs_employees
  ADD COLUMN IF NOT EXISTS valor_hora       numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_dia_padrao int DEFAULT 8;

-- 9. obs_presencas: horas trabalhadas por dia
ALTER TABLE public.obs_presencas
  ADD COLUMN IF NOT EXISTS horas_trabalhadas numeric(4,1) DEFAULT 8,
  ADD COLUMN IF NOT EXISTS horas_extra       numeric(4,1) DEFAULT 0;

-- 10. obs_checklists: status de assinatura (aprovado/bloqueado/aprovado_ressalva)
ALTER TABLE public.obs_checklists
  ADD COLUMN IF NOT EXISTS status_geral text DEFAULT 'pendente';

-- 11. obs_folhas: folha de pagamento mensal
CREATE TABLE IF NOT EXISTS public.obs_folhas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid REFERENCES public.obs_employees ON DELETE CASCADE,
  mes_ano       text NOT NULL,
  salario_base  numeric(10,2) DEFAULT 0,
  horas_normais numeric(6,1)  DEFAULT 0,
  horas_extra   numeric(6,1)  DEFAULT 0,
  dias_falta    int           DEFAULT 0,
  valor_hora    numeric(10,2) DEFAULT 0,
  valor_horas   numeric(12,2) DEFAULT 0,
  adiantamentos numeric(10,2) DEFAULT 0,
  descontos     numeric(10,2) DEFAULT 0,
  valor_liquido numeric(12,2) DEFAULT 0,
  status        text DEFAULT 'aberto' CHECK (status IN ('aberto','fechado','pago')),
  observacoes   text DEFAULT '',
  created_at    timestamptz DEFAULT now(),
  UNIQUE(employee_id, mes_ano)
);
ALTER TABLE public.obs_folhas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "obs_folhas_auth" ON public.obs_folhas;
CREATE POLICY "obs_folhas_auth" ON public.obs_folhas
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 12. obs_adiantamentos: adiantamentos salariais
CREATE TABLE IF NOT EXISTS public.obs_adiantamentos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    uuid REFERENCES public.obs_employees ON DELETE CASCADE,
  valor          numeric(10,2) NOT NULL,
  data           date NOT NULL,
  mes_referencia text DEFAULT '',
  motivo         text DEFAULT '',
  status         text DEFAULT 'pendente' CHECK (status IN ('pendente','descontado','cancelado')),
  created_by     uuid REFERENCES auth.users,
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE public.obs_adiantamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "obs_adiantamentos_auth" ON public.obs_adiantamentos;
CREATE POLICY "obs_adiantamentos_auth" ON public.obs_adiantamentos
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

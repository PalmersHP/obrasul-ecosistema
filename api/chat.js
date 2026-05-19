const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jmjbdundgbbefvhvyffb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM = `Você é o Assistente Obrasul, integrado ao sistema de gestão de obras da Obrasul. Você tem acesso completo ao sistema e pode consultar e operar todos os módulos. Use português brasileiro informal mas profissional. Seja direto e conciso.

Formatação:
- Valores: R$ X.XXX,XX
- Datas: DD/MM/AAAA
- UUIDs nunca exibir ao usuário — use nomes
- Status obras: prospeccao→"Prospecção", orcamento→"Orçamento", aprovado→"Aprovado", mobilizacao→"Mobilização", em_execucao→"Em execução", vistoria→"Vistoria", entregue→"Entregue", em_garantia→"Em garantia", cancelado→"Cancelado"
- Status financeiro receitas: em_aberto→"Em aberto", recebido→"Recebido", previsto→"Previsto", atrasado→"Atrasado"
- Status financeiro despesas: em_aberto→"Em aberto", pago→"Pago", previsto→"Previsto", aprovado→"Aprovado"
- Status compras: solicitado→"Solicitado", em_analise→"Em análise", aprovado→"Aprovado", comprado→"Comprado", entregue→"Entregue", cancelado→"Cancelado"

Regras:
- Quando precisar do ID de uma obra/cliente, use listar_obras ou listar_clientes para encontrá-lo primeiro
- Para ações destrutivas pergunte confirmação antes
- Ao criar registros, confirme com os dados principais (nunca mostre UUIDs)
- Se uma operação falhar, explique o erro claramente`;

// ── Definição das Tools ────────────────────────────────────────────────────

const TOOLS = [

  // ── OBRAS ──
  {
    name: 'listar_obras',
    description: 'Lista obras/projetos. Use para encontrar obras, filtrar por status, ou buscar pelo nome para obter o ID.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Status: prospeccao, orcamento, aprovado, mobilizacao, em_execucao, vistoria, entregue, em_garantia, cancelado. Omita para todos.' },
        busca: { type: 'string', description: 'Texto para buscar no nome ou endereço' }
      }
    }
  },
  {
    name: 'criar_obra',
    description: 'Cria uma nova obra/projeto no sistema.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Nome da obra' },
        cliente_id: { type: 'string', description: 'UUID do cliente. Use listar_clientes para encontrar.' },
        tipo_servico: { type: 'string', description: 'Tipo: fachada, impermeabilizacao_pilotis, impermeabilizacao_reservatorio, telhado, pintura_hall, pintura_area_comum, misto, outro' },
        status: { type: 'string', description: 'Status inicial. Padrão: prospeccao' },
        valor_contrato: { type: 'number', description: 'Valor do contrato em reais' },
        data_inicio: { type: 'string', description: 'Data início YYYY-MM-DD' },
        data_prev_fim: { type: 'string', description: 'Data previsão de fim YYYY-MM-DD' },
        endereco: { type: 'string', description: 'Endereço da obra' },
        cidade: { type: 'string', description: 'Cidade' },
        observacoes: { type: 'string', description: 'Observações gerais' }
      },
      required: ['nome']
    }
  },
  {
    name: 'atualizar_obra',
    description: 'Atualiza dados ou status de uma obra existente.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id: { type: 'string', description: 'UUID da obra. Use listar_obras para encontrar.' },
        status: { type: 'string', description: 'Novo status' },
        valor_contrato: { type: 'number', description: 'Valor do contrato' },
        data_inicio: { type: 'string', description: 'Data início YYYY-MM-DD' },
        data_prev_fim: { type: 'string', description: 'Previsão de fim YYYY-MM-DD' },
        data_fim: { type: 'string', description: 'Data de conclusão real YYYY-MM-DD' },
        observacoes: { type: 'string', description: 'Observações' }
      },
      required: ['obra_id']
    }
  },

  // ── CLIENTES ──
  {
    name: 'listar_clientes',
    description: 'Lista clientes/condomínios cadastrados. Use para encontrar o ID de um cliente.',
    input_schema: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Busca no nome do cliente' },
        limite: { type: 'number', description: 'Máximo de resultados. Padrão: 20' }
      }
    }
  },
  {
    name: 'criar_cliente',
    description: 'Cria um novo cliente (condomínio, pessoa física ou jurídica).',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Nome do cliente/condomínio' },
        tipo: { type: 'string', description: 'Tipo: condominio, pessoa_fisica, pessoa_juridica. Padrão: condominio' },
        cnpj: { type: 'string', description: 'CNPJ ou CPF' },
        sindico_nome: { type: 'string', description: 'Nome do síndico (para condomínios)' },
        sindico_email: { type: 'string', description: 'Email do síndico' },
        sindico_telefone: { type: 'string', description: 'Telefone do síndico' },
        endereco: { type: 'string', description: 'Endereço completo' },
        cidade: { type: 'string', description: 'Cidade' },
        estado: { type: 'string', description: 'Estado (sigla, ex: SP)' },
        observacoes: { type: 'string', description: 'Observações' }
      },
      required: ['nome']
    }
  },

  // ── FINANCEIRO ──
  {
    name: 'resumo_financeiro',
    description: 'Resumo financeiro: total a receber, recebido, pendente, a pagar, pago, saldo.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id: { type: 'string', description: 'UUID da obra para filtrar. Omita para resumo geral.' }
      }
    }
  },
  {
    name: 'listar_contas',
    description: 'Lista contas a receber ou a pagar com filtros.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['receber', 'pagar'], description: 'Tipo de conta' },
        status: { type: 'string', description: 'Status para filtrar. Omita para todos.' },
        obra_id: { type: 'string', description: 'UUID da obra para filtrar' },
        limite: { type: 'number', description: 'Quantidade máxima. Padrão: 15' }
      },
      required: ['tipo']
    }
  },
  {
    name: 'criar_receita',
    description: 'Cria uma conta a receber (entrada/receita) no financeiro.',
    input_schema: {
      type: 'object',
      properties: {
        descricao: { type: 'string', description: 'Descrição da receita' },
        valor: { type: 'number', description: 'Valor em reais' },
        data_vencimento: { type: 'string', description: 'Data de vencimento YYYY-MM-DD' },
        obra_id: { type: 'string', description: 'UUID da obra (opcional)' },
        status: { type: 'string', description: 'previsto, recebido ou em_aberto. Padrão: previsto' }
      },
      required: ['descricao', 'valor', 'data_vencimento']
    }
  },
  {
    name: 'criar_despesa',
    description: 'Cria uma conta a pagar (saída/despesa) no financeiro.',
    input_schema: {
      type: 'object',
      properties: {
        descricao: { type: 'string', description: 'Descrição da despesa' },
        valor: { type: 'number', description: 'Valor em reais' },
        data_vencimento: { type: 'string', description: 'Data de vencimento YYYY-MM-DD' },
        obra_id: { type: 'string', description: 'UUID da obra (opcional)' },
        status: { type: 'string', description: 'previsto, aprovado, pago. Padrão: previsto' }
      },
      required: ['descricao', 'valor', 'data_vencimento']
    }
  },
  {
    name: 'marcar_recebido',
    description: 'Marca uma conta a receber como recebida.',
    input_schema: {
      type: 'object',
      properties: {
        conta_id: { type: 'string', description: 'UUID da conta a receber. Use listar_contas para encontrar.' },
        data_recebimento: { type: 'string', description: 'Data do recebimento YYYY-MM-DD. Padrão: hoje.' }
      },
      required: ['conta_id']
    }
  },
  {
    name: 'marcar_pago',
    description: 'Marca uma conta a pagar como paga.',
    input_schema: {
      type: 'object',
      properties: {
        conta_id: { type: 'string', description: 'UUID da conta a pagar. Use listar_contas para encontrar.' },
        data_pagamento: { type: 'string', description: 'Data do pagamento YYYY-MM-DD. Padrão: hoje.' }
      },
      required: ['conta_id']
    }
  },

  // ── COMPRAS ──
  {
    name: 'listar_compras',
    description: 'Lista pedidos de compra com filtros.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'solicitado, em_analise, aprovado, comprado, entregue, cancelado. Omita para todos.' },
        obra_id: { type: 'string', description: 'UUID da obra para filtrar' },
        limite: { type: 'number', description: 'Quantidade máxima. Padrão: 15' }
      }
    }
  },
  {
    name: 'criar_pedido_compra',
    description: 'Cria um pedido de compra.',
    input_schema: {
      type: 'object',
      properties: {
        descricao: { type: 'string', description: 'O que precisa comprar' },
        quantidade: { type: 'number', description: 'Quantidade' },
        unidade: { type: 'string', description: 'Unidade: un, kg, m², m, sc, cx, pç, L, par' },
        valor_estimado: { type: 'number', description: 'Valor estimado total em reais (opcional)' },
        obra_id: { type: 'string', description: 'UUID da obra (opcional)' },
        urgencia: { type: 'string', description: 'baixa, normal, alta, urgente. Padrão: normal' },
        categoria: { type: 'string', description: 'Categoria do item' }
      },
      required: ['descricao', 'quantidade', 'unidade']
    }
  },
  {
    name: 'atualizar_status_compra',
    description: 'Atualiza o status de um pedido de compra (aprovar, reprovar, marcar como comprado/entregue).',
    input_schema: {
      type: 'object',
      properties: {
        compra_id: { type: 'string', description: 'UUID do pedido. Use listar_compras para encontrar.' },
        status: { type: 'string', description: 'Novo status: em_analise, aprovado, cancelado, comprado, entregue' },
        observacoes: { type: 'string', description: 'Observação sobre a decisão (opcional)' }
      },
      required: ['compra_id', 'status']
    }
  },

  // ── EQUIPE ──
  {
    name: 'listar_funcionarios',
    description: 'Lista funcionários/colaboradores cadastrados.',
    input_schema: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Busca no nome ou função' },
        ativo: { type: 'boolean', description: 'true para ativos, false para inativos. Omita para todos.' },
        limite: { type: 'number', description: 'Máximo de resultados. Padrão: 20' }
      }
    }
  },
  {
    name: 'criar_funcionario',
    description: 'Cadastra um novo funcionário/colaborador na equipe.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Nome completo' },
        funcao: { type: 'string', description: 'Função/cargo (ex: Pedreiro, Pintor, Encarregado)' },
        tipo_vinculo: { type: 'string', description: 'clt, pj, diarista, estagio. Padrão: clt' },
        cpf: { type: 'string', description: 'CPF (opcional)' },
        telefone: { type: 'string', description: 'Telefone (opcional)' },
        email: { type: 'string', description: 'Email (opcional)' },
        salario_base: { type: 'number', description: 'Salário base em reais (opcional)' },
        data_admissao: { type: 'string', description: 'Data de admissão YYYY-MM-DD (opcional)' },
        pix: { type: 'string', description: 'Chave PIX (opcional)' },
        observacoes: { type: 'string', description: 'Observações (opcional)' }
      },
      required: ['nome']
    }
  },

  // ── ESTOQUE ──
  {
    name: 'listar_estoque',
    description: 'Lista itens do estoque com quantidades e valores.',
    input_schema: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Busca no nome ou código do item' },
        abaixo_minimo: { type: 'boolean', description: 'true para mostrar apenas itens abaixo do estoque mínimo' },
        limite: { type: 'number', description: 'Máximo de resultados. Padrão: 20' }
      }
    }
  },
  {
    name: 'registrar_entrada_estoque',
    description: 'Registra uma entrada ou saída de material no estoque.',
    input_schema: {
      type: 'object',
      properties: {
        stock_id: { type: 'string', description: 'UUID do item. Use listar_estoque para encontrar.' },
        tipo: { type: 'string', description: 'entrada, saida ou ajuste' },
        quantidade: { type: 'number', description: 'Quantidade movimentada' },
        motivo: { type: 'string', description: 'Motivo ou descrição da movimentação' },
        responsavel: { type: 'string', description: 'Nome do responsável (opcional)' }
      },
      required: ['stock_id', 'tipo', 'quantidade']
    }
  },

  // ── GARANTIAS ──
  {
    name: 'listar_garantias',
    description: 'Lista chamados de garantia (pós-obra).',
    input_schema: {
      type: 'object',
      properties: {
        obra_id: { type: 'string', description: 'UUID da obra para filtrar' },
        status: { type: 'string', description: 'aberto, em_atendimento, resolvido, cancelado. Omita para todos.' },
        limite: { type: 'number', description: 'Máximo de resultados. Padrão: 15' }
      }
    }
  },
  {
    name: 'criar_garantia',
    description: 'Abre um chamado de garantia pós-obra.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id: { type: 'string', description: 'UUID da obra. Use listar_obras para encontrar.' },
        descricao: { type: 'string', description: 'Descrição do problema/chamado' },
        tipo: { type: 'string', description: 'hidraulico, eletrico, estrutural, acabamento, infiltracao, outro' },
        urgencia: { type: 'string', description: 'baixa, media, alta. Padrão: media' },
        solicitante: { type: 'string', description: 'Nome de quem solicitou' },
        contato: { type: 'string', description: 'Telefone ou email de contato' },
        prazo: { type: 'string', description: 'Prazo para atendimento YYYY-MM-DD (opcional)' }
      },
      required: ['obra_id', 'descricao']
    }
  },

  // ── COMUNICADOS ──
  {
    name: 'listar_comunicados',
    description: 'Lista comunicados de uma obra.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id: { type: 'string', description: 'UUID da obra' },
        limite: { type: 'number', description: 'Máximo de resultados. Padrão: 15' }
      },
      required: ['obra_id']
    }
  },
  {
    name: 'criar_comunicado',
    description: 'Envia um comunicado para uma obra (visível no portal do síndico).',
    input_schema: {
      type: 'object',
      properties: {
        obra_id: { type: 'string', description: 'UUID da obra. Use listar_obras para encontrar.' },
        mensagem: { type: 'string', description: 'Texto do comunicado' },
        tipo: { type: 'string', description: 'informativo, urgente, solicitacao, resposta. Padrão: informativo' },
        remetente_nome: { type: 'string', description: 'Nome do remetente. Padrão: Obrasul' }
      },
      required: ['obra_id', 'mensagem']
    }
  },

  // ── CONTRATOS ──
  {
    name: 'listar_contratos',
    description: 'Lista contratos cadastrados.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id: { type: 'string', description: 'UUID da obra para filtrar' },
        status: { type: 'string', description: 'em_negociacao, em_vigor, encerrado, rescindido. Omita para todos.' },
        limite: { type: 'number', description: 'Máximo de resultados. Padrão: 15' }
      }
    }
  },
  {
    name: 'criar_contrato',
    description: 'Cria um novo contrato.',
    input_schema: {
      type: 'object',
      properties: {
        objeto: { type: 'string', description: 'Objeto/descrição do contrato' },
        obra_id: { type: 'string', description: 'UUID da obra vinculada (opcional)' },
        tipo: { type: 'string', description: 'prestacao_servicos, fornecimento, manutencao, outro. Padrão: prestacao_servicos' },
        valor: { type: 'number', description: 'Valor do contrato em reais' },
        contratante: { type: 'string', description: 'Nome do contratante' },
        data_inicio: { type: 'string', description: 'Data de início YYYY-MM-DD' },
        data_fim: { type: 'string', description: 'Data de fim YYYY-MM-DD' },
        condicoes_pagamento: { type: 'string', description: 'Condições de pagamento' }
      },
      required: ['objeto']
    }
  },

  // ── RELATÓRIO ──
  {
    name: 'relatorio_obra',
    description: 'Gera um relatório completo de uma obra: dados gerais, financeiro, etapas, compras e garantias.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id: { type: 'string', description: 'UUID da obra. Use listar_obras para encontrar.' }
      },
      required: ['obra_id']
    }
  }
];

// ── Helpers Supabase ────────────────────────────────────────────────────────

const sbHeaders = (extra = {}) => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  ...extra
});

async function sbGet(table, filters = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(filters).forEach(([k, v]) => url.searchParams.append(k, v));
  const r = await fetch(url.toString(), { headers: sbHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbInsert(table, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbPatch(table, id, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: sbHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const today = () => new Date().toISOString().split('T')[0];

// ── Executores de Tool ──────────────────────────────────────────────────────

async function executeTool(name, input) {
  try {
    switch (name) {

      // ── OBRAS ──────────────────────────────────────────────────────────────
      case 'listar_obras': {
        const f = { select: 'id,nome,status,progresso,endereco,cidade,valor_contrato,data_inicio,data_prev_fim', order: 'created_at.desc', limit: '30' };
        if (input.status) f.status = `eq.${input.status}`;
        if (input.busca) f.nome = `ilike.%${input.busca}%`;
        const obras = await sbGet('obs_projects', f);
        return { obras, total: obras.length };
      }

      case 'criar_obra': {
        const rows = await sbInsert('obs_projects', {
          nome: input.nome,
          client_id: input.cliente_id || null,
          tipo_servico: input.tipo_servico || 'outro',
          status: input.status || 'prospeccao',
          valor_contrato: input.valor_contrato || 0,
          data_inicio: input.data_inicio || null,
          data_prev_fim: input.data_prev_fim || null,
          endereco: input.endereco || '',
          cidade: input.cidade || '',
          observacoes: input.observacoes || ''
        });
        return { sucesso: true, id: rows[0]?.id, nome: rows[0]?.nome };
      }

      case 'atualizar_obra': {
        const campos = {};
        if (input.status !== undefined) campos.status = input.status;
        if (input.valor_contrato !== undefined) campos.valor_contrato = input.valor_contrato;
        if (input.data_inicio !== undefined) campos.data_inicio = input.data_inicio;
        if (input.data_prev_fim !== undefined) campos.data_prev_fim = input.data_prev_fim;
        if (input.data_fim !== undefined) campos.data_fim = input.data_fim;
        if (input.observacoes !== undefined) campos.observacoes = input.observacoes;
        const rows = await sbPatch('obs_projects', input.obra_id, campos);
        return { sucesso: true, atualizado: rows[0]?.nome || input.obra_id };
      }

      // ── CLIENTES ───────────────────────────────────────────────────────────
      case 'listar_clientes': {
        const f = { select: 'id,nome,tipo,sindico_nome,cidade,telefone', order: 'nome.asc', limit: String(input.limite || 20) };
        if (input.busca) f.nome = `ilike.%${input.busca}%`;
        const clientes = await sbGet('obs_clients', f);
        return { clientes, total: clientes.length };
      }

      case 'criar_cliente': {
        const rows = await sbInsert('obs_clients', {
          nome: input.nome,
          tipo: input.tipo || 'condominio',
          cnpj: input.cnpj || '',
          sindico_nome: input.sindico_nome || '',
          sindico_email: input.sindico_email || '',
          sindico_telefone: input.sindico_telefone || '',
          endereco: input.endereco || '',
          cidade: input.cidade || '',
          estado: input.estado || '',
          observacoes: input.observacoes || ''
        });
        return { sucesso: true, id: rows[0]?.id, nome: rows[0]?.nome };
      }

      // ── FINANCEIRO ─────────────────────────────────────────────────────────
      case 'resumo_financeiro': {
        const rf = { select: 'valor,status' };
        const df = { select: 'valor,status' };
        if (input.obra_id) { rf.project_id = `eq.${input.obra_id}`; df.project_id = `eq.${input.obra_id}`; }
        const [rec, desp] = await Promise.all([sbGet('obs_receivables', rf), sbGet('obs_payables', df)]);
        const soma = (arr, fn) => arr.filter(fn).reduce((s, x) => s + Number(x.valor), 0);
        const totalRec = soma(rec, () => true);
        const recebido = soma(rec, r => r.status === 'recebido');
        const totalDesp = soma(desp, () => true);
        const pago = soma(desp, d => d.status === 'pago');
        return { a_receber_total: totalRec, recebido, a_receber_pendente: totalRec - recebido, a_pagar_total: totalDesp, pago, a_pagar_pendente: totalDesp - pago, saldo_previsto: totalRec - totalDesp, saldo_realizado: recebido - pago };
      }

      case 'listar_contas': {
        const table = input.tipo === 'receber' ? 'obs_receivables' : 'obs_payables';
        const f = { select: 'id,descricao,valor,status,data_vencimento,project_id', order: 'data_vencimento.asc', limit: String(input.limite || 15) };
        if (input.status) f.status = `eq.${input.status}`;
        if (input.obra_id) f.project_id = `eq.${input.obra_id}`;
        const contas = await sbGet(table, f);
        return { contas, total: contas.length };
      }

      case 'criar_receita': {
        const rows = await sbInsert('obs_receivables', {
          descricao: input.descricao, valor: input.valor,
          data_vencimento: input.data_vencimento,
          project_id: input.obra_id || null,
          status: input.status || 'previsto'
        });
        return { sucesso: true, id: rows[0]?.id };
      }

      case 'criar_despesa': {
        const rows = await sbInsert('obs_payables', {
          descricao: input.descricao, valor: input.valor,
          data_vencimento: input.data_vencimento,
          project_id: input.obra_id || null,
          status: input.status || 'previsto'
        });
        return { sucesso: true, id: rows[0]?.id };
      }

      case 'marcar_recebido': {
        const rows = await sbPatch('obs_receivables', input.conta_id, {
          status: 'recebido',
          data_recebimento: input.data_recebimento || today()
        });
        return { sucesso: true, descricao: rows[0]?.descricao };
      }

      case 'marcar_pago': {
        const rows = await sbPatch('obs_payables', input.conta_id, {
          status: 'pago',
          data_pagamento: input.data_pagamento || today()
        });
        return { sucesso: true, descricao: rows[0]?.descricao };
      }

      // ── COMPRAS ────────────────────────────────────────────────────────────
      case 'listar_compras': {
        const f = { select: 'id,descricao,quantidade,unidade,valor_estimado,status,urgencia,categoria,project_id', order: 'created_at.desc', limit: String(input.limite || 15) };
        if (input.status) f.status = `eq.${input.status}`;
        if (input.obra_id) f.project_id = `eq.${input.obra_id}`;
        const pedidos = await sbGet('obs_purchase_requests', f);
        return { pedidos, total: pedidos.length };
      }

      case 'criar_pedido_compra': {
        const rows = await sbInsert('obs_purchase_requests', {
          descricao: input.descricao, quantidade: input.quantidade, unidade: input.unidade,
          valor_estimado: input.valor_estimado || null,
          project_id: input.obra_id || null,
          urgencia: input.urgencia || 'normal',
          categoria: input.categoria || null,
          status: 'solicitado'
        });
        return { sucesso: true, id: rows[0]?.id };
      }

      case 'atualizar_status_compra': {
        const campos = { status: input.status };
        if (input.observacoes) campos.observacoes = input.observacoes;
        const rows = await sbPatch('obs_purchase_requests', input.compra_id, campos);
        return { sucesso: true, descricao: rows[0]?.descricao, status: rows[0]?.status };
      }

      // ── EQUIPE ─────────────────────────────────────────────────────────────
      case 'listar_funcionarios': {
        const f = { select: 'id,nome,funcao,tipo_vinculo,nivel,salario_base,telefone,email,ativo,data_admissao', order: 'nome.asc', limit: String(input.limite || 20) };
        if (input.busca) f.nome = `ilike.%${input.busca}%`;
        if (input.ativo !== undefined) f.ativo = `eq.${input.ativo}`;
        const funcionarios = await sbGet('obs_employees', f);
        return { funcionarios, total: funcionarios.length };
      }

      case 'criar_funcionario': {
        const rows = await sbInsert('obs_employees', {
          nome: input.nome,
          funcao: input.funcao || '',
          tipo_vinculo: input.tipo_vinculo || 'clt',
          cpf: input.cpf || '',
          telefone: input.telefone || '',
          email: input.email || '',
          salario_base: input.salario_base || 0,
          data_admissao: input.data_admissao || null,
          pix: input.pix || '',
          observacoes: input.observacoes || '',
          ativo: true
        });
        return { sucesso: true, id: rows[0]?.id, nome: rows[0]?.nome };
      }

      // ── ESTOQUE ────────────────────────────────────────────────────────────
      case 'listar_estoque': {
        const f = { select: 'id,nome,codigo,categoria,quantidade,unidade,quantidade_minima,valor_unitario,local,ativo', order: 'nome.asc', limit: String(input.limite || 20) };
        if (input.busca) f.nome = `ilike.%${input.busca}%`;
        let itens = await sbGet('obs_stock', f);
        if (input.abaixo_minimo) itens = itens.filter(i => Number(i.quantidade) <= Number(i.quantidade_minima));
        return { itens, total: itens.length };
      }

      case 'registrar_entrada_estoque': {
        const rows = await sbInsert('obs_stock_movimentos', {
          stock_id: input.stock_id,
          tipo: input.tipo,
          quantidade: input.quantidade,
          motivo: input.motivo || '',
          responsavel: input.responsavel || ''
        });
        // Atualizar quantidade no item
        const [item] = await sbGet('obs_stock', { select: 'id,quantidade', id: `eq.${input.stock_id}` });
        if (item) {
          const delta = input.tipo === 'saida' ? -Math.abs(input.quantidade) : Math.abs(input.quantidade);
          await sbPatch('obs_stock', input.stock_id, { quantidade: Number(item.quantidade) + delta });
        }
        return { sucesso: true, movimento_id: rows[0]?.id };
      }

      // ── GARANTIAS ──────────────────────────────────────────────────────────
      case 'listar_garantias': {
        const f = { select: 'id,descricao,tipo,urgencia,status,solicitante,data_abertura,prazo,project_id', order: 'created_at.desc', limit: String(input.limite || 15) };
        if (input.obra_id) f.project_id = `eq.${input.obra_id}`;
        if (input.status) f.status = `eq.${input.status}`;
        const garantias = await sbGet('obs_garantias', f);
        return { garantias, total: garantias.length };
      }

      case 'criar_garantia': {
        const rows = await sbInsert('obs_garantias', {
          project_id: input.obra_id,
          descricao: input.descricao,
          tipo: input.tipo || 'outro',
          urgencia: input.urgencia || 'media',
          solicitante: input.solicitante || '',
          contato: input.contato || '',
          data_abertura: today(),
          prazo: input.prazo || null,
          status: 'aberto'
        });
        return { sucesso: true, id: rows[0]?.id };
      }

      // ── COMUNICADOS ────────────────────────────────────────────────────────
      case 'listar_comunicados': {
        const f = { select: 'id,mensagem,tipo,remetente,remetente_nome,lido,created_at', project_id: `eq.${input.obra_id}`, order: 'created_at.desc', limit: String(input.limite || 15) };
        const comunicados = await sbGet('obs_comunicados', f);
        return { comunicados, total: comunicados.length };
      }

      case 'criar_comunicado': {
        const rows = await sbInsert('obs_comunicados', {
          project_id: input.obra_id,
          mensagem: input.mensagem,
          tipo: input.tipo || 'informativo',
          remetente: 'obrasul',
          remetente_nome: input.remetente_nome || 'Obrasul'
        });
        return { sucesso: true, id: rows[0]?.id };
      }

      // ── CONTRATOS ──────────────────────────────────────────────────────────
      case 'listar_contratos': {
        const f = { select: 'id,objeto,tipo,status,valor,contratante,data_inicio,data_fim,project_id', order: 'created_at.desc', limit: String(input.limite || 15) };
        if (input.obra_id) f.project_id = `eq.${input.obra_id}`;
        if (input.status) f.status = `eq.${input.status}`;
        const contratos = await sbGet('obs_contracts', f);
        return { contratos, total: contratos.length };
      }

      case 'criar_contrato': {
        const rows = await sbInsert('obs_contracts', {
          objeto: input.objeto,
          project_id: input.obra_id || null,
          tipo: input.tipo || 'prestacao_servicos',
          valor: input.valor || 0,
          contratante: input.contratante || '',
          data_inicio: input.data_inicio || null,
          data_fim: input.data_fim || null,
          condicoes_pagamento: input.condicoes_pagamento || '',
          status: 'em_negociacao'
        });
        return { sucesso: true, id: rows[0]?.id };
      }

      // ── RELATÓRIO ──────────────────────────────────────────────────────────
      case 'relatorio_obra': {
        const oid = input.obra_id;
        const [obras, rec, desp, compras, garantias, etapas] = await Promise.all([
          sbGet('obs_projects', { select: 'id,nome,status,progresso,valor_contrato,valor_recebido,valor_custo,data_inicio,data_prev_fim,data_fim,endereco,cidade,tipo_servico', id: `eq.${oid}` }),
          sbGet('obs_receivables', { select: 'valor,status', project_id: `eq.${oid}` }),
          sbGet('obs_payables', { select: 'valor,status', project_id: `eq.${oid}` }),
          sbGet('obs_purchase_requests', { select: 'descricao,quantidade,unidade,valor_estimado,status,urgencia', project_id: `eq.${oid}`, limit: '50' }),
          sbGet('obs_garantias', { select: 'descricao,tipo,urgencia,status', project_id: `eq.${oid}`, limit: '20' }),
          sbGet('obs_project_stages', { select: 'nome,status,perc_peso,data_prev,data_conclusao', project_id: `eq.${oid}`, order: 'ordem.asc' })
        ]);
        const obra = obras[0];
        if (!obra) return { erro: 'Obra não encontrada' };
        const soma = (arr, fn) => arr.filter(fn).reduce((s, x) => s + Number(x.valor), 0);
        return {
          obra,
          financeiro: {
            a_receber: soma(rec, () => true),
            recebido: soma(rec, r => r.status === 'recebido'),
            a_pagar: soma(desp, () => true),
            pago: soma(desp, d => d.status === 'pago')
          },
          compras: { total: compras.length, pendentes: compras.filter(c => ['solicitado', 'em_analise'].includes(c.status)).length, itens: compras },
          garantias: { total: garantias.length, abertas: garantias.filter(g => g.status === 'aberto').length },
          etapas: { total: etapas.length, concluidas: etapas.filter(e => e.status === 'concluida').length, itens: etapas }
        };
      }

      default:
        return { erro: `Tool desconhecida: ${name}` };
    }
  } catch (e) {
    return { erro: e.message };
  }
}

// ── Handler principal ──────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!ANTHROPIC_KEY) return res.status(500).json({ erro: 'ANTHROPIC_API_KEY não configurada.' });
  if (!SUPABASE_KEY) return res.status(500).json({ erro: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' });

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ erro: 'Campo messages obrigatório.' });

  try {
    let msgs = [...messages];
    let resposta = '(sem resposta)';

    for (let i = 0; i < 10; i++) {
      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2048, system: SYSTEM, messages: msgs, tools: TOOLS })
      });

      const data = await apiRes.json();
      if (data.error) throw new Error(data.error.message);

      if (data.stop_reason === 'end_turn') {
        resposta = data.content.find(b => b.type === 'text')?.text || resposta;
        break;
      }

      if (data.stop_reason === 'tool_use') {
        const toolBlocks = data.content.filter(b => b.type === 'tool_use');
        msgs.push({ role: 'assistant', content: data.content });
        const results = await Promise.all(toolBlocks.map(async tu => ({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(await executeTool(tu.name, tu.input))
        })));
        msgs.push({ role: 'user', content: results });
      }
    }

    return res.json({ resposta, messages: msgs });
  } catch (e) {
    console.error('[chat]', e);
    return res.status(500).json({ erro: e.message });
  }
};

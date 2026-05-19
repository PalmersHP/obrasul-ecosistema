const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jmjbdundgbbefvhvyffb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM = `Você é o Assistente Obrasul, integrado ao sistema de gestão de obras da Obrasul. Você consulta dados reais e executa operações no sistema para ajudar os operadores. Use português brasileiro informal mas profissional. Seja direto e conciso.

Formatação:
- Valores monetários: R$ X.XXX,XX (use Intl.NumberFormat mentalmente)
- Datas: DD/MM/AAAA
- Status recebíveis: em_aberto→"Em aberto", recebido→"Recebido", previsto→"Previsto", atrasado→"Atrasado"
- Status pagamentos: em_aberto→"Em aberto", pago→"Pago", previsto→"Previsto", aprovado→"Aprovado"
- Status compras: solicitado→"Solicitado", aprovado→"Aprovado", comprado→"Comprado", entregue→"Entregue"
- Status obras: em_andamento→"Em andamento", encerrada→"Encerrada", pausada→"Pausada"

Ao criar registros, execute direto e confirme com os dados criados. Nunca invente dados — use somente o que as tools retornam.`;

const TOOLS = [
  {
    name: 'listar_obras',
    description: 'Lista obras/projetos cadastrados. Use para encontrar obras, listar por status ou buscar pelo nome.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['em_andamento', 'encerrada', 'pausada', 'todas'], description: 'Filtrar por status. Padrão: todas' },
        busca: { type: 'string', description: 'Busca no nome ou endereço da obra' }
      }
    }
  },
  {
    name: 'resumo_financeiro',
    description: 'Resumo financeiro: total a receber, recebido, pendente, total a pagar, pago, saldo.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id: { type: 'string', description: 'UUID da obra para filtrar. Omita para resumo geral.' }
      }
    }
  },
  {
    name: 'listar_contas',
    description: 'Lista contas a receber ou contas a pagar com filtros.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['receber', 'pagar'], description: 'Tipo de conta' },
        status: { type: 'string', description: 'Status para filtrar (ex: previsto, recebido, pago, em_aberto). Omita para todos.' },
        obra_id: { type: 'string', description: 'UUID da obra para filtrar' },
        limite: { type: 'number', description: 'Quantidade máxima. Padrão: 10' }
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
        status: { type: 'string', enum: ['previsto', 'recebido', 'em_aberto'], description: 'Status. Padrão: previsto' }
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
        status: { type: 'string', enum: ['previsto', 'pago', 'em_aberto', 'aprovado'], description: 'Status. Padrão: previsto' }
      },
      required: ['descricao', 'valor', 'data_vencimento']
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
        unidade: { type: 'string', description: 'Unidade (un, kg, m², m, sc, cx, pç, L)' },
        valor_estimado: { type: 'number', description: 'Valor estimado total em reais (opcional)' },
        obra_id: { type: 'string', description: 'UUID da obra (opcional)' },
        urgencia: { type: 'string', enum: ['baixa', 'normal', 'alta', 'urgente'], description: 'Urgência. Padrão: normal' },
        categoria: { type: 'string', description: 'Categoria (ex: Material de Construção, EPI, Ferramentas, Elétrico, Hidráulico)' }
      },
      required: ['descricao', 'quantidade', 'unidade']
    }
  },
  {
    name: 'listar_compras',
    description: 'Lista pedidos de compra com filtros.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Status: solicitado, em_analise, aprovado, comprado, entregue, cancelado. Omita para todos.' },
        obra_id: { type: 'string', description: 'UUID da obra para filtrar' },
        limite: { type: 'number', description: 'Quantidade máxima. Padrão: 10' }
      }
    }
  }
];

// ── Supabase REST helpers ───────────────────────────────────────────────────

async function sbGet(table, filters = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(filters).forEach(([k, v]) => url.searchParams.append(k, v));
  const res = await fetch(url.toString(), {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sbInsert(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Tool executor ──────────────────────────────────────────────────────────

async function executeTool(name, input) {
  try {
    switch (name) {

      case 'listar_obras': {
        const f = { select: 'id,nome,status,progresso,endereco,created_at', order: 'created_at.desc', limit: '20' };
        if (input.status && input.status !== 'todas') f.status = `eq.${input.status}`;
        if (input.busca) f.nome = `ilike.%${input.busca}%`;
        const obras = await sbGet('obs_projects', f);
        return { obras, total: obras.length };
      }

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
        return {
          a_receber_total: totalRec,
          recebido,
          a_receber_pendente: totalRec - recebido,
          a_pagar_total: totalDesp,
          pago,
          a_pagar_pendente: totalDesp - pago,
          saldo_previsto: totalRec - totalDesp,
          saldo_realizado: recebido - pago
        };
      }

      case 'listar_contas': {
        const table = input.tipo === 'receber' ? 'obs_receivables' : 'obs_payables';
        const f = { select: 'id,descricao,valor,status,data_vencimento,project_id', order: 'data_vencimento.asc', limit: String(input.limite || 10) };
        if (input.status) f.status = `eq.${input.status}`;
        if (input.obra_id) f.project_id = `eq.${input.obra_id}`;
        const contas = await sbGet(table, f);
        return { contas, total: contas.length };
      }

      case 'criar_receita': {
        const rows = await sbInsert('obs_receivables', {
          descricao: input.descricao,
          valor: input.valor,
          data_vencimento: input.data_vencimento,
          project_id: input.obra_id || null,
          status: input.status || 'previsto'
        });
        return { sucesso: true, id: rows[0]?.id };
      }

      case 'criar_despesa': {
        const rows = await sbInsert('obs_payables', {
          descricao: input.descricao,
          valor: input.valor,
          data_vencimento: input.data_vencimento,
          project_id: input.obra_id || null,
          status: input.status || 'previsto'
        });
        return { sucesso: true, id: rows[0]?.id };
      }

      case 'criar_pedido_compra': {
        const rows = await sbInsert('obs_purchase_requests', {
          descricao: input.descricao,
          quantidade: input.quantidade,
          unidade: input.unidade,
          valor_estimado: input.valor_estimado || null,
          project_id: input.obra_id || null,
          urgencia: input.urgencia || 'normal',
          categoria: input.categoria || null,
          status: 'solicitado'
        });
        return { sucesso: true, id: rows[0]?.id };
      }

      case 'listar_compras': {
        const f = { select: 'id,descricao,quantidade,unidade,valor_estimado,status,urgencia,categoria,project_id', order: 'created_at.desc', limit: String(input.limite || 10) };
        if (input.status) f.status = `eq.${input.status}`;
        if (input.obra_id) f.project_id = `eq.${input.obra_id}`;
        const pedidos = await sbGet('obs_purchase_requests', f);
        return { pedidos, total: pedidos.length };
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

  if (!ANTHROPIC_KEY) return res.status(500).json({ erro: 'Variável ANTHROPIC_API_KEY não configurada no Vercel.' });
  if (!SUPABASE_KEY) return res.status(500).json({ erro: 'Variável SUPABASE_SERVICE_ROLE_KEY não configurada no Vercel.' });

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ erro: 'Campo messages obrigatório.' });

  try {
    let msgs = [...messages];
    let resposta = '(sem resposta)';

    // Loop agêntico — Claude chama tools até gerar resposta final
    for (let i = 0; i < 8; i++) {
      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: SYSTEM,
          messages: msgs,
          tools: TOOLS
        })
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

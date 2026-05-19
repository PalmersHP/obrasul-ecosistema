const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jmjbdundgbbefvhvyffb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hdrs = () => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, PATCH, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SUPABASE_KEY) return res.status(500).json({ erro: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' });

  const body = req.body || {};

  // ── DELETE: excluir usuário ──────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { userId } = body;
    if (!userId) return res.status(400).json({ erro: 'userId obrigatório.' });

    // Remove do obs_perfis primeiro
    await fetch(`${SUPABASE_URL}/rest/v1/obs_perfis?id=eq.${userId}`, {
      method: 'DELETE', headers: hdrs(),
    });

    // Remove do auth.users
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE', headers: hdrs(),
    });
    if (!r.ok) return res.status(r.status).json({ erro: await r.text() });
    return res.json({ sucesso: true });
  }

  // ── PATCH: atualizar email via admin ─────────────────────────────────────
  if (req.method === 'PATCH') {
    const { userId, email } = body;
    if (!userId || !email) return res.status(400).json({ erro: 'userId e email obrigatórios.' });

    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: hdrs(),
      body: JSON.stringify({ email }),
    });
    if (!r.ok) return res.status(r.status).json({ erro: await r.text() });

    // Atualiza email no obs_perfis também
    await fetch(`${SUPABASE_URL}/rest/v1/obs_perfis?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...hdrs(), Prefer: 'return=minimal' },
      body: JSON.stringify({ email }),
    });

    return res.json({ sucesso: true });
  }

  // ── POST: criar usuário ou reenviar confirmação ──────────────────────────
  if (req.method === 'POST') {
    const { action, email, password, nome, cargo, role } = body;

    // Criar novo usuário via admin API (sem rate limit, sem e-mail de confirmação obrigatório)
    if (action === 'create') {
      if (!email || !password || !nome) return res.status(400).json({ erro: 'email, password e nome obrigatórios.' });

      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: hdrs(),
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      if (!r.ok) return res.status(r.status).json({ erro: await r.text() });
      const { id: userId } = await r.json();

      // Cria perfil no obs_perfis
      await fetch(`${SUPABASE_URL}/rest/v1/obs_perfis`, {
        method: 'POST',
        headers: { ...hdrs(), Prefer: 'return=minimal' },
        body: JSON.stringify({ id: userId, nome, email, cargo: cargo||'', role: role||'engenheiro', ativo: true }),
      });

      return res.json({ sucesso: true, userId });
    }

    // Reenviar e-mail de confirmação
    if (!email) return res.status(400).json({ erro: 'email obrigatório.' });
    const r = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
      method: 'POST',
      headers: hdrs(),
      body: JSON.stringify({ type: 'signup', email }),
    });
    if (!r.ok) return res.status(r.status).json({ erro: await r.text() });
    return res.json({ sucesso: true });
  }

  return res.status(405).end();
};

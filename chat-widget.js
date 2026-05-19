(function () {
  'use strict';

  const ENDPOINT = '/api/chat';
  const GREETING = 'Olá! Sou o Assistente Obrasul 🏗️\nPosso consultar obras, financeiro e compras, e também criar lançamentos.\nComo posso ajudar?';

  let _msgs = [];
  let _busy = false;
  let _open = false;

  // ── Estilos ───────────────────────────────────────────────────────────────

  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
#obs-chat-btn {
  position:fixed; bottom:24px; right:24px; z-index:9998;
  width:52px; height:52px; border-radius:50%; border:none; cursor:pointer;
  background:#1e3a5f; color:#fff; font-size:22px; box-shadow:0 4px 16px #0004;
  display:flex; align-items:center; justify-content:center;
  transition:background .2s, transform .15s;
}
#obs-chat-btn:hover { background:#2d5a9a; transform:scale(1.08); }
#obs-chat-panel {
  position:fixed; bottom:88px; right:24px; z-index:9999;
  width:360px; height:520px; max-height:80vh;
  background:#fff; border-radius:14px; box-shadow:0 8px 32px #0003;
  display:flex; flex-direction:column; overflow:hidden;
  border:1px solid #e2e8f0;
  animation:obs-slide-in .2s ease;
}
@keyframes obs-slide-in { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
#obs-chat-header {
  background:#1e3a5f; color:#fff; padding:12px 16px;
  display:flex; align-items:center; justify-content:space-between; flex-shrink:0;
}
#obs-chat-header .obs-hdr-left { display:flex; align-items:center; gap:8px; }
#obs-chat-header .obs-hdr-icon { font-size:18px; }
#obs-chat-header .obs-hdr-title { font-weight:700; font-size:.9rem; }
#obs-chat-header .obs-hdr-sub { font-size:.7rem; color:#94a3b8; margin-top:1px; }
#obs-chat-close {
  background:none; border:none; color:#94a3b8; cursor:pointer; font-size:20px;
  line-height:1; padding:0 2px;
}
#obs-chat-close:hover { color:#fff; }
#obs-chat-messages {
  flex:1; overflow-y:auto; padding:14px 12px; display:flex; flex-direction:column; gap:10px;
  scroll-behavior:smooth;
}
.obs-msg {
  max-width:88%; padding:9px 13px; border-radius:12px; font-size:.82rem; line-height:1.5;
  word-break:break-word;
}
.obs-msg-user {
  background:#1e3a5f; color:#fff; align-self:flex-end; border-bottom-right-radius:3px;
}
.obs-msg-assistant {
  background:#f1f5f9; color:#1e293b; align-self:flex-start; border-bottom-left-radius:3px;
}
.obs-msg-assistant a { color:#3b82f6; }
.obs-typing { display:flex; gap:4px; align-items:center; padding:12px 14px; }
.obs-typing span {
  width:7px; height:7px; border-radius:50%; background:#94a3b8;
  animation:obs-bounce .9s infinite;
}
.obs-typing span:nth-child(2) { animation-delay:.15s; }
.obs-typing span:nth-child(3) { animation-delay:.3s; }
@keyframes obs-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
#obs-chat-footer {
  padding:10px 12px; border-top:1px solid #e2e8f0; flex-shrink:0;
  display:flex; gap:8px; align-items:flex-end; background:#fff;
}
#obs-chat-input {
  flex:1; border:1px solid #cbd5e1; border-radius:8px; padding:8px 11px;
  font-size:.82rem; resize:none; outline:none; max-height:100px; min-height:36px;
  font-family:inherit; line-height:1.4;
  transition:border-color .15s;
}
#obs-chat-input:focus { border-color:#3b82f6; }
#obs-chat-send {
  width:36px; height:36px; border-radius:8px; border:none; cursor:pointer;
  background:#1e3a5f; color:#fff; font-size:16px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  transition:background .15s;
}
#obs-chat-send:hover:not(:disabled) { background:#2d5a9a; }
#obs-chat-send:disabled { background:#94a3b8; cursor:default; }
.obs-chip-row { display:flex; flex-wrap:wrap; gap:5px; margin-top:4px; }
.obs-chip {
  font-size:.72rem; padding:3px 9px; border-radius:20px; cursor:pointer;
  background:#e2e8f0; color:#475569; border:none;
  transition:background .15s;
}
.obs-chip:hover { background:#cbd5e1; }
@media(max-width:480px){
  #obs-chat-panel { width:calc(100vw - 24px); right:12px; bottom:80px; }
}
`;
    document.head.appendChild(s);
  }

  // ── HTML ──────────────────────────────────────────────────────────────────

  function createDOM() {
    // Botão flutuante
    const btn = document.createElement('button');
    btn.id = 'obs-chat-btn';
    btn.title = 'Assistente Obrasul';
    btn.innerHTML = '🤖';
    btn.onclick = togglePanel;
    document.body.appendChild(btn);

    // Painel
    const panel = document.createElement('div');
    panel.id = 'obs-chat-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <div id="obs-chat-header">
        <div class="obs-hdr-left">
          <span class="obs-hdr-icon">🏗️</span>
          <div>
            <div class="obs-hdr-title">Assistente Obrasul</div>
            <div class="obs-hdr-sub">IA integrada ao sistema</div>
          </div>
        </div>
        <button id="obs-chat-close" title="Fechar">✕</button>
      </div>
      <div id="obs-chat-messages"></div>
      <div id="obs-chat-footer">
        <textarea id="obs-chat-input" placeholder="Digite um comando..." rows="1"></textarea>
        <button id="obs-chat-send" title="Enviar">➤</button>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById('obs-chat-close').onclick = togglePanel;
    document.getElementById('obs-chat-send').onclick = sendMessage;
    document.getElementById('obs-chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    document.getElementById('obs-chat-input').addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });
  }

  // ── Painel ─────────────────────────────────────────────────────────────────

  function togglePanel() {
    _open = !_open;
    const panel = document.getElementById('obs-chat-panel');
    panel.style.display = _open ? 'flex' : 'none';
    if (_open) {
      if (_msgs.length === 0) appendMsg('assistant', GREETING, true);
      document.getElementById('obs-chat-input').focus();
    }
  }

  // ── Renderização de mensagens ──────────────────────────────────────────────

  function formatMd(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:#e2e8f0;padding:1px 4px;border-radius:3px;font-size:.8em">$1</code>')
      .replace(/^#{1,3} (.+)$/gm, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function appendMsg(role, text, withChips) {
    const container = document.getElementById('obs-chat-messages');
    const div = document.createElement('div');
    div.className = `obs-msg obs-msg-${role}`;
    div.innerHTML = formatMd(text);

    if (withChips && role === 'assistant') {
      const row = document.createElement('div');
      row.className = 'obs-chip-row';
      const chips = ['Ver obras', 'Resumo financeiro', 'Compras pendentes'];
      chips.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'obs-chip';
        btn.textContent = c;
        btn.onclick = () => { setInput(c); sendMessage(); };
        row.appendChild(btn);
      });
      div.appendChild(document.createElement('br'));
      div.appendChild(row);
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = document.getElementById('obs-chat-messages');
    const div = document.createElement('div');
    div.className = 'obs-msg obs-msg-assistant obs-typing';
    div.id = 'obs-typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('obs-typing-indicator');
    if (el) el.remove();
  }

  function setInput(text) {
    const inp = document.getElementById('obs-chat-input');
    inp.value = text;
    inp.style.height = 'auto';
  }

  // ── Envio ──────────────────────────────────────────────────────────────────

  async function sendMessage() {
    if (_busy) return;
    const inp = document.getElementById('obs-chat-input');
    const text = inp.value.trim();
    if (!text) return;

    inp.value = '';
    inp.style.height = 'auto';

    appendMsg('user', text);
    _msgs.push({ role: 'user', content: text });

    _busy = true;
    document.getElementById('obs-chat-send').disabled = true;
    showTyping();

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: _msgs })
      });

      hideTyping();

      if (!res.ok) {
        const err = await res.json().catch(() => ({ erro: `HTTP ${res.status}` }));
        appendMsg('assistant', '⚠️ ' + (err.erro || 'Erro ao contatar o assistente.'));
      } else {
        const data = await res.json();
        if (data.erro) {
          appendMsg('assistant', '⚠️ ' + data.erro);
        } else {
          appendMsg('assistant', data.resposta);
          _msgs = data.messages.filter(m => typeof m.content === 'string');
        }
      }
    } catch (e) {
      hideTyping();
      appendMsg('assistant', '⚠️ Erro de conexão. Verifique sua internet e tente novamente.');
    }

    _busy = false;
    document.getElementById('obs-chat-send').disabled = false;
    document.getElementById('obs-chat-input').focus();
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    injectStyles();
    createDOM();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

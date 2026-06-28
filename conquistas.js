// ═══════════════════════════════════════════════
// MCELL — CONQUISTAS
// Sistema de gamificação para vendedores
// ═══════════════════════════════════════════════

let _conquistasCatalogo = null;

async function getCatalogo() {
  if (!_conquistasCatalogo) {
    _conquistasCatalogo = await db.getCatalogoConquistas();
  }
  return _conquistasCatalogo;
}

// ── VERIFICAÇÃO AUTOMÁTICA ─────────────────────
// Chamada após registrar uma venda, ou ao abrir a página
async function verificarConquistas(vendedoraId) {
  if (!vendedoraId) return [];

  try {
    const [catalogo, desbloqueadas, stats, metasInfo] = await Promise.all([
      getCatalogo(),
      db.getConquistasDesbloqueadas(vendedoraId),
      db.getStatsParaConquistas(vendedoraId),
      db.getMetasBatidasCount(vendedoraId)
    ]);

    const idsDesbloqueados = new Set(desbloqueadas.map(d => d.conquista_id));
    const novasDesbloqueadas = [];

    for (const c of catalogo) {
      if (idsDesbloqueados.has(c.id)) continue; // já tem

      const crit = c.criterio;
      let atingiu = false;

      switch (crit.tipo) {
        case 'total_aparelhos':
          atingiu = stats.totalAparelhos >= crit.valor;
          break;
        case 'max_dia':
          atingiu = stats.maxDia >= crit.valor;
          break;
        case 'metas_batidas':
          atingiu = metasInfo.count >= crit.valor;
          break;
        case 'pct_meta':
          atingiu = metasInfo.melhorPct >= crit.valor;
          break;
      }

      if (atingiu) {
        await db.desbloquearConquista(vendedoraId, c.id);
        novasDesbloqueadas.push(c);
      }
    }

    return novasDesbloqueadas;
  } catch (err) {
    console.warn('Erro ao verificar conquistas:', err.message);
    return [];
  }
}

// Chama a verificação e mostra animação se algo novo foi desbloqueado
async function verificarEAnimar(vendedoraId) {
  const novas = await verificarConquistas(vendedoraId);
  if (novas.length > 0) {
    mostrarAnimacaoConquista(novas[0], novas.length > 1 ? novas.length - 1 : 0);
  }
  return novas;
}

// ── ANIMAÇÃO DE DESBLOQUEIO ────────────────────
function mostrarAnimacaoConquista(conquista, restantes = 0) {
  const overlay = document.createElement('div');
  overlay.className = 'conquista-overlay';
  overlay.innerHTML = `
    <div class="conquista-confete" id="conquista-confete"></div>
    <div class="conquista-modal">
      <div class="conquista-badge-grande">
        <div class="conquista-glow"></div>
        <div class="conquista-icone-grande">${conquista.icone}</div>
      </div>
      <div class="conquista-label">🎉 Nova Conquista!</div>
      <div class="conquista-nome-grande">${conquista.nome}</div>
      <div class="conquista-desc-grande">${conquista.descricao}</div>
      <div class="conquista-pontos-grande">+${conquista.pontos} pontos</div>
      ${restantes > 0 ? `<div class="conquista-mais">+${restantes} outra${restantes>1?'s':''} conquista${restantes>1?'s':''} desbloqueada${restantes>1?'s':''}!</div>` : ''}
      <button class="btn-primary btn-full" id="btn-fechar-conquista">Continuar</button>
    </div>
  `;
  document.body.appendChild(overlay);

  // Gera confete
  const confeteEl = overlay.querySelector('#conquista-confete');
  const cores = ['#FC4C04', '#22c55e', '#3d7eff', '#f59e0b', '#a855f7'];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('div');
    piece.className = 'confete-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = cores[Math.floor(Math.random()*cores.length)];
    piece.style.animationDelay = (Math.random() * 0.5) + 's';
    piece.style.animationDuration = (2 + Math.random() * 1.5) + 's';
    confeteEl.appendChild(piece);
  }

  // Som leve via Web Audio (opcional, sem arquivo externo)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(523.25, ctx.currentTime);
    o.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
    o.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.start(); o.stop(ctx.currentTime + 0.6);
  } catch {}

  function fechar() {
    overlay.classList.add('conquista-fechando');
    setTimeout(() => overlay.remove(), 300);
  }
  overlay.querySelector('#btn-fechar-conquista').addEventListener('click', fechar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });
}

// ── PÁGINA DE CONQUISTAS ───────────────────────
async function renderConquistas() {
  const page = document.getElementById('page-conquistas');
  page.innerHTML = `<div class="spinner"></div>`;

  try {
    let vendedoraId = isAdmin() ? null : getVendedoraId();
    let ativas = [];

    if (isAdmin()) {
      ativas = await db.getVendedoras(true);
      if (!vendedoraId && ativas.length > 0) vendedoraId = ativas[0].id;
    }

    if (!vendedoraId) {
      page.innerHTML = `<div class="empty-state"><div class="icon">🏆</div><p>Sua conta não está vinculada a uma vendedora.</p></div>`;
      return;
    }

    await _renderConquistasPara(page, vendedoraId, ativas);

  } catch (err) {
    page.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>${err.message}</p></div>`;
  }
}

let _selectedVendedoraConquista = null;

async function _renderConquistasPara(page, vendedoraId, ativasPreload = []) {
  page.innerHTML = `<div class="spinner"></div>`;

  const [catalogo, desbloqueadas, vendedoras] = await Promise.all([
    getCatalogo(),
    db.getConquistasDesbloqueadas(vendedoraId),
    isAdmin() ? Promise.resolve(ativasPreload.length ? ativasPreload : await db.getVendedoras(true)) : db.getVendedoras(true)
  ]);

  const ativas = vendedoras.filter(v => v.status === 'ativa');
  const nomeVend = ativas.find(v => v.id === vendedoraId)?.nome || currentProfile?.nome || 'Você';
  const idsDesbloqueados = new Map(desbloqueadas.map(d => [d.conquista_id, d.desbloqueado_em]));
  const totalPontos = catalogo.filter(c => idsDesbloqueados.has(c.id)).reduce((s,c) => s + c.pontos, 0);
  const totalDesbloqueadas = idsDesbloqueados.size;

  // Seletor admin
  const seletor = isAdmin() ? `
    <div class="desemp-selector" style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px">
      <div>
        <label>Ver conquistas de:</label>
        <select id="sel-vend-conquista">
          ${ativas.map(v => `<option value="${v.id}" ${v.id===vendedoraId?'selected':''}>${v.nome}</option>`).join('')}
        </select>
      </div>
      <button class="btn-primary btn-sm" id="btn-verificar-todas">🔄 Verificar Todas Agora</button>
    </div>` : '';

  // Agrupar por categoria
  const categorias = {
    volume: { titulo: '📦 Volume de Vendas', items: [] },
    meta:   { titulo: '🎯 Metas Batidas', items: [] },
    recorde:{ titulo: '🔥 Recordes', items: [] }
  };
  catalogo.forEach(c => { if (categorias[c.categoria]) categorias[c.categoria].items.push(c); });

  page.innerHTML = `
    ${seletor}

    <div class="conquista-hero">
      <div class="conquista-hero-icon">🏆</div>
      <div class="conquista-hero-info">
        <div class="conquista-hero-nome">${nomeVend}</div>
        <div class="conquista-hero-sub">${totalDesbloqueadas} de ${catalogo.length} conquistas desbloqueadas</div>
      </div>
      <div class="conquista-hero-pontos">
        <div class="pontos-num">${totalPontos}</div>
        <div class="pontos-label">pontos</div>
      </div>
    </div>

    <div class="conquista-progress-bar">
      <div class="conquista-progress-fill" style="width:${(totalDesbloqueadas/catalogo.length*100)}%"></div>
    </div>

    ${Object.values(categorias).map(cat => `
      <div class="conquista-categoria">
        <div class="conquista-cat-titulo">${cat.titulo}</div>
        <div class="conquista-grid">
          ${cat.items.map(c => renderBadgeConquista(c, idsDesbloqueados.has(c.id), idsDesbloqueados.get(c.id))).join('')}
        </div>
      </div>
    `).join('')}
  `;

  // Seletor admin listener
  document.getElementById('sel-vend-conquista')?.addEventListener('change', async (e) => {
    _selectedVendedoraConquista = e.target.value;
    await _renderConquistasPara(page, e.target.value, ativas);
  });

  // Verificar todas de uma vez (retroativo)
  document.getElementById('btn-verificar-todas')?.addEventListener('click', async () => {
    await verificarTodasVendedoras(ativas, page, vendedoraId);
  });

  // Clique no badge mostra detalhes
  document.querySelectorAll('.conquista-badge').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const c = catalogo.find(x => x.id === id);
      const desbloqueado = idsDesbloqueados.has(id);
      abrirDetalheConquista(c, desbloqueado, idsDesbloqueados.get(id));
    });
  });
}

function renderBadgeConquista(c, desbloqueado, dataDesbloqueio) {
  return `
    <div class="conquista-badge ${desbloqueado ? 'unlocked' : 'locked'}" data-id="${c.id}">
      <div class="conquista-badge-icon">${desbloqueado ? c.icone : '🔒'}</div>
      <div class="conquista-badge-nome">${c.nome}</div>
      <div class="conquista-badge-desc">${c.descricao}</div>
      <div class="conquista-badge-pontos">${c.pontos} pts</div>
    </div>`;
}

function abrirDetalheConquista(c, desbloqueado, dataDesbloqueio) {
  openModal(`
    <div style="text-align:center">
      <div class="conquista-badge-grande" style="margin:0 auto 16px">
        <div class="conquista-glow ${desbloqueado?'':'locked'}"></div>
        <div class="conquista-icone-grande">${desbloqueado ? c.icone : '🔒'}</div>
      </div>
      <div class="modal-title" style="text-align:center">${c.nome}</div>
      <div class="modal-subtitle" style="text-align:center">${c.descricao}</div>
      <div style="display:flex;justify-content:center;gap:24px;margin:16px 0">
        <div>
          <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:800;color:var(--blue)">${c.pontos}</div>
          <div style="font-size:0.75rem;color:var(--text2)">pontos</div>
        </div>
        <div>
          <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:800;color:${desbloqueado?'var(--green)':'var(--text3)'}">
            ${desbloqueado ? '✓' : '—'}
          </div>
          <div style="font-size:0.75rem;color:var(--text2)">${desbloqueado ? 'Desbloqueada' : 'Bloqueada'}</div>
        </div>
      </div>
      ${desbloqueado && dataDesbloqueio ? `
        <div style="color:var(--text2);font-size:0.82rem">
          Desbloqueada em ${new Date(dataDesbloqueio).toLocaleDateString('pt-BR')}
        </div>` : ''}
      <button class="btn-ghost btn-full" style="margin-top:16px" onclick="closeModal()">Fechar</button>
    </div>
  `);
}

// ── VERIFICAÇÃO RETROATIVA EM LOTE (admin) ─────
async function verificarTodasVendedoras(ativas, page, vendedoraIdAtual) {
  if (!confirm(`Verificar o histórico completo de ${ativas.length} vendedor(es) e liberar conquistas já conquistadas? Isso pode levar alguns segundos.`)) return;

  // Modal de progresso
  openModal(`
    <div style="text-align:center;padding:20px 0">
      <div class="spinner" style="margin:0 auto 16px"></div>
      <div class="modal-title" style="text-align:center">Verificando conquistas…</div>
      <div id="verif-progresso" style="color:var(--text2);font-size:0.87rem;margin-top:8px">Iniciando…</div>
    </div>
  `);

  const resultados = [];
  let i = 0;

  for (const v of ativas) {
    i++;
    const progEl = document.getElementById('verif-progresso');
    if (progEl) progEl.textContent = `Verificando ${v.nome}… (${i}/${ativas.length})`;

    try {
      const novas = await verificarConquistas(v.id);
      if (novas.length > 0) {
        resultados.push({ nome: v.nome, conquistas: novas });
      }
    } catch (e) {
      console.warn(`Erro ao verificar ${v.nome}:`, e.message);
    }
  }

  // Mostra resumo final
  const totalConquistas = resultados.reduce((s,r) => s + r.conquistas.length, 0);
  const totalPontos = resultados.reduce((s,r) => s + r.conquistas.reduce((sp,c)=>sp+c.pontos,0), 0);

  if (resultados.length === 0) {
    openModal(`
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:2.5rem;margin-bottom:12px">✅</div>
        <div class="modal-title" style="text-align:center">Tudo em dia!</div>
        <div class="modal-subtitle" style="text-align:center">Nenhuma conquista nova foi encontrada — todos já estão com as conquistas atualizadas.</div>
        <button class="btn-primary btn-full" style="margin-top:16px" onclick="closeModal()">Fechar</button>
      </div>
    `);
  } else {
    openModal(`
      <div class="modal-title">🎉 Conquistas Liberadas!</div>
      <div class="modal-subtitle">${totalConquistas} conquista${totalConquistas>1?'s':''} desbloqueada${totalConquistas>1?'s':''} em ${resultados.length} vendedor(es) · +${totalPontos} pontos no total</div>
      <div style="max-height:320px;overflow-y:auto;margin:16px 0">
        ${resultados.map(r => `
          <div style="padding:12px 0;border-bottom:1px solid var(--border)">
            <div style="font-weight:700;margin-bottom:8px">${r.nome}</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${r.conquistas.map(c => `
                <span class="badge badge-yellow" style="font-size:0.78rem">${c.icone} ${c.nome} (+${c.pontos})</span>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <button class="btn-primary btn-full" id="btn-fechar-resultado">Concluir</button>
    `);
    document.getElementById('btn-fechar-resultado').addEventListener('click', () => {
      closeModal();
      _renderConquistasPara(page, vendedoraIdAtual, ativas);
    });
    return;
  }

  closeModal();
  _renderConquistasPara(page, vendedoraIdAtual, ativas);
}

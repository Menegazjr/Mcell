// ═══════════════════════════════════════════════
// MCELL — METAS (apenas aparelhos)
// ═══════════════════════════════════════════════

async function renderMetas() {
  if (!isAdmin()) {
    document.getElementById('page-metas').innerHTML =
      `<div class="empty-state"><div class="icon">🔒</div><p>Acesso restrito.</p></div>`;
    return;
  }

  const page = document.getElementById('page-metas');
  page.innerHTML = `<div class="spinner"></div>`;

  try {
    const [todas, vendedorasAtivas, metaAtual] = await Promise.all([
      db.getAllMetas(),
      db.getVendedoras(true),
      db.getMeta(currentMes, currentAno)
    ]);

    const numAtivas = vendedorasAtivas.length || 1;
    const metaApar  = metaAtual?.meta_aparelhos || 0;
    const indApar   = metaApar / numAtivas;

    page.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">◎ Meta — ${mesToNomeCompleto(currentMes)}/${currentAno}</div>
          <button class="btn-primary btn-sm" id="btn-editar-meta">
            ${metaAtual ? 'Editar Meta' : '+ Definir Meta'}
          </button>
        </div>

        ${metaAtual ? `
          <div class="cards-grid">
            ${cardMeta('Meta de Aparelhos', fmtNum(metaApar) + ' un.', 'green')}
            ${cardMeta('Meta Individual', indApar.toFixed(1) + ' un.', 'blue')}
            ${cardMeta('Vendedoras Ativas', numAtivas, 'green')}
          </div>
          <p style="color:var(--text2);font-size:0.82rem;margin-top:8px">
            Meta dividida automaticamente entre ${numAtivas} vendedora${numAtivas>1?'s':''} ativa${numAtivas>1?'s':''}
          </p>
        ` : `
          <div class="empty-state">
            <div class="icon">◎</div>
            <p>Nenhuma meta definida para ${mesToNomeCompleto(currentMes)}/${currentAno}.</p>
          </div>
        `}
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📅 Histórico de Metas</div>
        </div>
        <div class="table-wrap">
          ${renderHistoricoMetas(todas)}
        </div>
      </div>
    `;

    document.getElementById('btn-editar-meta').addEventListener('click', () => {
      abrirFormMeta(metaAtual);
    });

    document.querySelectorAll('.btn-edit-meta').forEach(btn => {
      const m = todas.find(x => x.id === btn.dataset.id);
      btn.addEventListener('click', () => abrirFormMeta(m));
    });

  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

function cardMeta(label, value, accent) {
  return `
    <div class="card">
      <div class="card-accent ${accent}"></div>
      <div class="card-label">${label}</div>
      <div class="card-value">${value}</div>
    </div>`;
}

function renderHistoricoMetas(metas) {
  if (!metas.length) return `<div class="empty-state"><p>Nenhuma meta cadastrada.</p></div>`;
  const rows = [...metas].reverse().map(m => `
    <tr>
      <td><strong>${mesToNomeCompleto(m.mes)}</strong></td>
      <td>${m.ano}</td>
      <td>${fmtNum(m.meta_aparelhos)} un.</td>
      <td>
        <button class="btn-ghost btn-sm btn-edit-meta" data-id="${m.id}">Editar</button>
      </td>
    </tr>`).join('');

  return `
    <table>
      <thead><tr><th>Mês</th><th>Ano</th><th>Meta Aparelhos</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function abrirFormMeta(meta) {
  const isEdit = !!meta;
  openModal(`
    <div class="modal-title">${isEdit ? 'Editar' : 'Definir'} Meta</div>
    <div class="modal-subtitle">${mesToNomeCompleto(currentMes)}/${currentAno}</div>
    <form id="form-meta">
      <div class="form-grid">
        <div class="form-group">
          <label>Mês *</label>
          <select id="fm-mes">
            ${[...Array(12)].map((_,i)=>`<option value="${i+1}" ${(meta?.mes||currentMes)===(i+1)?'selected':''}>${mesToNomeCompleto(i+1)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Ano *</label>
          <input type="number" id="fm-ano" min="2020" max="2099"
            value="${meta?.ano || currentAno}"/>
        </div>
        <div class="form-group form-full">
          <label>Meta de Aparelhos *</label>
          <input type="number" id="fm-apar" min="0"
            value="${meta?.meta_aparelhos || ''}" placeholder="140"/>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-ghost" id="btn-cancel-meta">Cancelar</button>
        <button type="submit" class="btn-primary">${isEdit ? 'Salvar' : 'Definir Meta'}</button>
      </div>
    </form>
  `);

  document.getElementById('btn-cancel-meta').addEventListener('click', closeModal);

  document.getElementById('form-meta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.textContent = 'Salvando…';
    btn.disabled = true;

    try {
      await db.upsertMeta({
        ...(isEdit ? { id: meta.id } : {}),
        mes:            parseInt(document.getElementById('fm-mes').value),
        ano:            parseInt(document.getElementById('fm-ano').value),
        meta_aparelhos: parseInt(document.getElementById('fm-apar').value)
      });
      toast('Meta salva com sucesso!');
      closeModal();
      renderMetas();
    } catch (err) {
      toast('Erro: ' + err.message, 'error');
      btn.textContent = isEdit ? 'Salvar' : 'Definir Meta';
      btn.disabled = false;
    }
  });
}

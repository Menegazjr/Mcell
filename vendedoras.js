// ═══════════════════════════════════════════════
// MCELL — VENDEDORAS
// ═══════════════════════════════════════════════

async function renderVendedoras() {
  if (!isAdmin()) {
    document.getElementById('page-vendedoras').innerHTML =
      `<div class="empty-state"><div class="icon">🔒</div><p>Acesso restrito a administradores.</p></div>`;
    return;
  }

  const page = document.getElementById('page-vendedoras');
  page.innerHTML = `<div class="spinner"></div>`;

  try {
    const vendedoras = await db.getVendedoras();

    page.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">👤 Vendedoras <span>${vendedoras.length} cadastradas</span></div>
          <button class="btn-primary btn-sm" id="btn-nova-vendedora">+ Nova Vendedora</button>
        </div>
        <div class="table-wrap">
          ${renderTabelaVendedoras(vendedoras)}
        </div>
      </div>
    `;

    document.getElementById('btn-nova-vendedora').addEventListener('click', () => {
      abrirFormVendedora(null);
    });

    document.querySelectorAll('.btn-edit-vend').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = vendedoras.find(x => x.id === btn.dataset.id);
        abrirFormVendedora(v);
      });
    });

    document.querySelectorAll('.btn-toggle-vend').forEach(btn => {
      btn.addEventListener('click', async () => {
        const v = vendedoras.find(x => x.id === btn.dataset.id);
        const novoStatus = v.status === 'ativa' ? 'inativa' : 'ativa';
        await db.upsertVendedora({ ...v, status: novoStatus });
        toast(`Vendedora ${novoStatus === 'ativa' ? 'ativada' : 'desativada'}.`);
        renderVendedoras();
      });
    });

    document.querySelectorAll('.btn-del-vend').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir esta vendedora? As vendas associadas serão mantidas.')) return;
        try {
          await db.deleteVendedora(btn.dataset.id);
          toast('Vendedora excluída.');
          renderVendedoras();
        } catch (err) {
          toast('Erro ao excluir: ' + err.message, 'error');
        }
      });
    });

  } catch (err) {
    page.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>${err.message}</p></div>`;
  }
}

function renderTabelaVendedoras(vendedoras) {
  if (!vendedoras.length) return `
    <div class="empty-state">
      <div class="icon">◉</div>
      <p>Nenhuma vendedora cadastrada ainda.</p>
    </div>`;

  const rows = vendedoras.map(v => `
    <tr>
      <td><strong>${v.nome}</strong></td>
      <td>${v.telefone || '—'}</td>
      <td>${fmtDate(v.data_admissao)}</td>
      <td><span class="badge ${v.status==='ativa'?'badge-green':'badge-red'}">
        ${v.status==='ativa'?'● Ativa':'○ Inativa'}
      </span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-ghost btn-sm btn-edit-vend" data-id="${v.id}">Editar</button>
          <button class="btn-ghost btn-sm btn-toggle-vend" data-id="${v.id}">
            ${v.status==='ativa'?'Desativar':'Ativar'}
          </button>
          <button class="btn-danger btn-sm btn-del-vend" data-id="${v.id}">Excluir</button>
        </div>
      </td>
    </tr>`).join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Nome</th>
          <th>Telefone</th>
          <th>Admissão</th>
          <th>Status</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function abrirFormVendedora(v) {
  const isEdit = !!v;
  openModal(`
    <div class="modal-title">${isEdit ? 'Editar' : 'Nova'} Vendedora</div>
    <div class="modal-subtitle">${isEdit ? 'Altere os dados abaixo.' : 'Preencha os dados da nova vendedora.'}</div>
    <form id="form-vendedora">
      <div class="form-grid">
        <div class="form-group form-full">
          <label>Nome *</label>
          <input type="text" id="fv-nome" required value="${v?.nome||''}" placeholder="Nome completo"/>
        </div>
        <div class="form-group">
          <label>Telefone</label>
          <input type="tel" id="fv-tel" value="${v?.telefone||''}" placeholder="(00) 00000-0000"/>
        </div>
        <div class="form-group">
          <label>Data de Admissão</label>
          <input type="date" id="fv-admissao" value="${v?.data_admissao||''}"/>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="fv-status">
            <option value="ativa"  ${(!v||v.status==='ativa')?'selected':''}>Ativa</option>
            <option value="inativa"${v?.status==='inativa'?'selected':''}>Inativa</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-ghost" id="btn-cancel-vend">Cancelar</button>
        <button type="submit" class="btn-primary">${isEdit?'Salvar':'Cadastrar'}</button>
      </div>
    </form>
  `);

  document.getElementById('btn-cancel-vend').addEventListener('click', closeModal);

  document.getElementById('form-vendedora').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.textContent = 'Salvando…';
    btn.disabled = true;

    try {
      const payload = {
        ...(isEdit ? { id: v.id } : {}),
        nome:          document.getElementById('fv-nome').value.trim(),
        telefone:      document.getElementById('fv-tel').value.trim() || null,
        data_admissao: document.getElementById('fv-admissao').value || null,
        status:        document.getElementById('fv-status').value
      };
      await db.upsertVendedora(payload);
      toast(`Vendedora ${isEdit?'atualizada':'cadastrada'} com sucesso!`);
      closeModal();
      renderVendedoras();
    } catch (err) {
      toast('Erro: ' + err.message, 'error');
      btn.textContent = isEdit ? 'Salvar' : 'Cadastrar';
      btn.disabled = false;
    }
  });
}

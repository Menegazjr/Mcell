// ═══════════════════════════════════════════════
// MCELL — VENDEDORAS (com criação de acesso)
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
    const [vendedoras, profiles] = await Promise.all([
      db.getVendedoras(),
      db.getAllProfiles()
    ]);

    // Mapear vendedora_id -> tem acesso?
    const comAcesso = new Set(profiles.filter(p => p.vendedora_id).map(p => p.vendedora_id));

    page.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">👤 Vendedoras <span>${vendedoras.length} cadastradas</span></div>
          <button class="btn-primary btn-sm" id="btn-nova-vendedora">+ Nova Vendedora</button>
        </div>
        <div class="table-wrap">
          ${renderTabelaVendedoras(vendedoras, comAcesso)}
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

    // Botão criar acesso
    document.querySelectorAll('.btn-criar-acesso').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = vendedoras.find(x => x.id === btn.dataset.id);
        abrirFormAcesso(v);
      });
    });

  } catch (err) {
    page.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>${err.message}</p></div>`;
  }
}

function renderTabelaVendedoras(vendedoras, comAcesso) {
  if (!vendedoras.length) return `
    <div class="empty-state">
      <div class="icon">◉</div>
      <p>Nenhuma vendedora cadastrada ainda.</p>
    </div>`;

  const rows = vendedoras.map(v => {
    const temAcesso = comAcesso.has(v.id);
    return `
    <tr>
      <td><strong>${v.nome}</strong></td>
      <td>${v.telefone || '—'}</td>
      <td>${fmtDate(v.data_admissao)}</td>
      <td><span class="badge ${v.status==='ativa'?'badge-green':'badge-red'}">
        ${v.status==='ativa'?'● Ativa':'○ Inativa'}
      </span></td>
      <td>
        <span class="badge ${temAcesso?'badge-blue':'badge-yellow'}" title="${temAcesso?'Tem login no sistema':'Sem acesso ao sistema'}">
          ${temAcesso?'🔓 Com acesso':'🔒 Sem acesso'}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-ghost btn-sm btn-edit-vend" data-id="${v.id}">Editar</button>
          <button class="btn-ghost btn-sm btn-toggle-vend" data-id="${v.id}">
            ${v.status==='ativa'?'Desativar':'Ativar'}
          </button>
          ${!temAcesso ? `<button class="btn-primary btn-sm btn-criar-acesso" data-id="${v.id}">+ Criar Acesso</button>` : ''}
          <button class="btn-danger btn-sm btn-del-vend" data-id="${v.id}">Excluir</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Nome</th>
          <th>Telefone</th>
          <th>Admissão</th>
          <th>Status</th>
          <th>Acesso</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── FORM VENDEDORA ─────────────────────────────
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

// ── FORM CRIAR ACESSO ──────────────────────────
function abrirFormAcesso(v) {
  openModal(`
    <div class="modal-title">🔓 Criar Acesso</div>
    <div class="modal-subtitle">Crie o login de <strong>${v.nome}</strong> no sistema.</div>
    <div class="acesso-info">
      <span class="badge badge-blue">◉ ${v.nome}</span>
      <p>A vendedora poderá fazer login e acessar apenas seus próprios dados.</p>
    </div>
    <form id="form-acesso">
      <div class="form-grid">
        <div class="form-group form-full">
          <label>E-mail de acesso *</label>
          <input type="email" id="fa-email" placeholder="email@exemplo.com" required/>
        </div>
        <div class="form-group">
          <label>Senha *</label>
          <input type="password" id="fa-senha" placeholder="Mínimo 6 caracteres" required/>
        </div>
        <div class="form-group">
          <label>Confirmar Senha *</label>
          <input type="password" id="fa-senha2" placeholder="Repita a senha" required/>
        </div>
      </div>
      <div id="acesso-error" class="login-error hidden"></div>
      <div class="form-actions">
        <button type="button" class="btn-ghost" id="btn-cancel-acesso">Cancelar</button>
        <button type="submit" class="btn-primary">Criar Acesso</button>
      </div>
    </form>
  `);

  document.getElementById('btn-cancel-acesso').addEventListener('click', closeModal);

  document.getElementById('form-acesso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn   = e.target.querySelector('button[type=submit]');
    const errEl = document.getElementById('acesso-error');
    const email = document.getElementById('fa-email').value.trim();
    const senha = document.getElementById('fa-senha').value;
    const senha2= document.getElementById('fa-senha2').value;

    errEl.classList.add('hidden');

    if (senha.length < 6) {
      errEl.textContent = 'A senha deve ter pelo menos 6 caracteres.';
      errEl.classList.remove('hidden'); return;
    }
    if (senha !== senha2) {
      errEl.textContent = 'As senhas não coincidem.';
      errEl.classList.remove('hidden'); return;
    }

    btn.textContent = 'Criando…';
    btn.disabled = true;

    try {
      // Criar usuário via Supabase Admin API (usa a função no banco)
      const { data, error } = await _supabase.functions.invoke('create-user', {
        body: {
          email,
          password: senha,
          nome: v.nome,
          role: 'vendedora',
          vendedora_id: v.id
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast(`Acesso criado para ${v.nome}! E-mail: ${email}`);
      closeModal();
      renderVendedoras();
    } catch (err) {
      errEl.textContent = 'Erro: ' + (err.message || 'Não foi possível criar o acesso.');
      errEl.classList.remove('hidden');
      btn.textContent = 'Criar Acesso';
      btn.disabled = false;
    }
  });
}

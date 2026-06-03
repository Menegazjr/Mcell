// ═══════════════════════════════════════════════
// MCELL — VENDEDORAS + ADMINISTRADORES
// ═══════════════════════════════════════════════

let vendedorasTab = 'vendedoras'; // 'vendedoras' | 'admins'

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

    const admins    = profiles.filter(p => p.role === 'admin');
    const comAcesso = new Set(profiles.filter(p => p.vendedora_id).map(p => p.vendedora_id));

    page.innerHTML = `
      <!-- ABAS -->
      <div class="tabs">
        <button class="tab-btn ${vendedorasTab==='vendedoras'?'active':''}" data-tab="vendedoras">
          👤 Vendedoras <span class="tab-count">${vendedoras.length}</span>
        </button>
        <button class="tab-btn ${vendedorasTab==='admins'?'active':''}" data-tab="admins">
          🛡 Administradores <span class="tab-count">${admins.length}</span>
        </button>
      </div>

      <!-- PAINEL VENDEDORAS -->
      <div id="tab-vendedoras" class="tab-panel ${vendedorasTab==='vendedoras'?'active':''}">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">👤 Vendedoras <span>${vendedoras.length} cadastradas</span></div>
            <button class="btn-primary btn-sm" id="btn-nova-vendedora">+ Nova Vendedora</button>
          </div>
          <div class="table-wrap">
            ${renderTabelaVendedoras(vendedoras, comAcesso)}
          </div>
        </div>
      </div>

      <!-- PAINEL ADMINS -->
      <div id="tab-admins" class="tab-panel ${vendedorasTab==='admins'?'active':''}">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">🛡 Administradores <span>${admins.length} cadastrados</span></div>
            <button class="btn-primary btn-sm" id="btn-novo-admin">+ Novo Admin</button>
          </div>
          <div class="table-wrap">
            ${renderTabelaAdmins(admins)}
          </div>
        </div>
      </div>
    `;

    // ── TABS ──────────────────────────────────────
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        vendedorasTab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === vendedorasTab));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${vendedorasTab}`));
      });
    });

    // ── VENDEDORAS ────────────────────────────────
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

    document.querySelectorAll('.btn-criar-acesso').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = vendedoras.find(x => x.id === btn.dataset.id);
        abrirFormAcesso(v);
      });
    });

    // ── ADMINS ────────────────────────────────────
    document.getElementById('btn-novo-admin').addEventListener('click', () => {
      abrirFormAdmin(null);
    });

    document.querySelectorAll('.btn-del-admin').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.id === currentUser.id) {
          toast('Você não pode excluir sua própria conta.', 'error');
          return;
        }
        if (!confirm('Remover este administrador? O acesso será revogado.')) return;
        try {
          const { error } = await _supabase.functions.invoke('create-user', {
            body: { action: 'delete', userId: btn.dataset.id }
          });
          if (error) throw error;
          toast('Administrador removido.');
          renderVendedoras();
        } catch (err) {
          // Fallback: apenas remove o perfil admin (downgrade para vendedora)
          await _supabase.from('profiles').update({ role: 'vendedora' }).eq('id', btn.dataset.id);
          toast('Acesso de admin revogado.');
          renderVendedoras();
        }
      });
    });

  } catch (err) {
    page.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>${err.message}</p></div>`;
  }
}

// ── TABELA VENDEDORAS ──────────────────────────
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
        <span class="badge ${temAcesso?'badge-blue':'badge-yellow'}">
          ${temAcesso?'🔓 Com acesso':'🔒 Sem acesso'}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:nowrap">
          <button class="btn-ghost btn-sm btn-edit-vend" data-id="${v.id}">Editar</button>
          <button class="btn-ghost btn-sm btn-toggle-vend" data-id="${v.id}">
            ${v.status==='ativa'?'Desativar':'Ativar'}
          </button>
          ${!temAcesso ? `<button class="btn-primary btn-sm btn-criar-acesso" data-id="${v.id}">+ Acesso</button>` : ''}
          <button class="btn-danger btn-sm btn-del-vend" data-id="${v.id}">Excluir</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Nome</th><th>Telefone</th><th>Admissão</th>
          <th>Status</th><th>Acesso</th><th>Ações</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── TABELA ADMINS ──────────────────────────────
function renderTabelaAdmins(admins) {
  if (!admins.length) return `
    <div class="empty-state">
      <div class="icon">🛡</div>
      <p>Nenhum administrador cadastrado.</p>
    </div>`;

  const rows = admins.map(a => {
    const isMe = a.id === currentUser?.id;
    return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:30px;height:30px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;flex-shrink:0">
            ${(a.nome||'A').charAt(0).toUpperCase()}
          </div>
          <strong>${a.nome || '—'}</strong>
          ${isMe ? '<span class="badge badge-blue" style="font-size:0.68rem">Você</span>' : ''}
        </div>
      </td>
      <td><span class="badge badge-green">🛡 Admin</span></td>
      <td>${fmtDate(a.created_at?.split('T')[0])}</td>
      <td>
        ${!isMe ? `<button class="btn-danger btn-sm btn-del-admin" data-id="${a.id}">Revogar</button>` : '<span style="color:var(--text3);font-size:0.8rem">—</span>'}
      </td>
    </tr>`;
  }).join('');

  return `
    <table>
      <thead>
        <tr><th>Nome</th><th>Perfil</th><th>Desde</th><th>Ações</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── FORM NOVO ADMIN ────────────────────────────
function abrirFormAdmin() {
  openModal(`
    <div class="modal-title">🛡 Novo Administrador</div>
    <div class="modal-subtitle">Crie um acesso com permissões completas ao sistema.</div>
    <div class="acesso-info">
      <p>⚠️ Administradores podem ver tudo, gerenciar vendedoras, definir metas e criar usuários.</p>
    </div>
    <form id="form-admin">
      <div class="form-grid">
        <div class="form-group form-full">
          <label>Nome *</label>
          <input type="text" id="fa-nome" placeholder="Nome completo" required/>
        </div>
        <div class="form-group form-full">
          <label>E-mail *</label>
          <input type="email" id="fa-email" placeholder="admin@exemplo.com" required/>
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
      <div id="admin-error" class="login-error hidden"></div>
      <div class="form-actions">
        <button type="button" class="btn-ghost" id="btn-cancel-admin">Cancelar</button>
        <button type="submit" class="btn-primary">Criar Administrador</button>
      </div>
    </form>
  `);

  document.getElementById('btn-cancel-admin').addEventListener('click', closeModal);

  document.getElementById('form-admin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn   = e.target.querySelector('button[type=submit]');
    const errEl = document.getElementById('admin-error');
    const nome  = document.getElementById('fa-nome').value.trim();
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
      const { data, error } = await _supabase.functions.invoke('create-user', {
        body: { email, password: senha, nome, role: 'admin', vendedora_id: null }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast(`Administrador ${nome} criado com sucesso!`);
      closeModal();
      vendedorasTab = 'admins';
      renderVendedoras();
    } catch (err) {
      errEl.textContent = 'Erro: ' + (err.message || 'Não foi possível criar o administrador.');
      errEl.classList.remove('hidden');
      btn.textContent = 'Criar Administrador';
      btn.disabled = false;
    }
  });
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
      await db.upsertVendedora({
        ...(isEdit ? { id: v.id } : {}),
        nome:          document.getElementById('fv-nome').value.trim(),
        telefone:      document.getElementById('fv-tel').value.trim() || null,
        data_admissao: document.getElementById('fv-admissao').value || null,
        status:        document.getElementById('fv-status').value
      });
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

// ── FORM CRIAR ACESSO VENDEDORA ────────────────
function abrirFormAcesso(v) {
  openModal(`
    <div class="modal-title">🔓 Criar Acesso</div>
    <div class="modal-subtitle">Login para <strong>${v.nome}</strong> no sistema.</div>
    <div class="acesso-info">
      <span class="badge badge-blue">◉ ${v.nome}</span>
      <p>A vendedora poderá fazer login e acessar apenas seus próprios dados.</p>
    </div>
    <form id="form-acesso">
      <div class="form-grid">
        <div class="form-group form-full">
          <label>E-mail *</label>
          <input type="email" id="fac-email" placeholder="email@exemplo.com" required/>
        </div>
        <div class="form-group">
          <label>Senha *</label>
          <input type="password" id="fac-senha" placeholder="Mínimo 6 caracteres" required/>
        </div>
        <div class="form-group">
          <label>Confirmar Senha *</label>
          <input type="password" id="fac-senha2" placeholder="Repita a senha" required/>
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
    const email = document.getElementById('fac-email').value.trim();
    const senha = document.getElementById('fac-senha').value;
    const senha2= document.getElementById('fac-senha2').value;

    errEl.classList.add('hidden');
    if (senha.length < 6) { errEl.textContent = 'Senha com mínimo 6 caracteres.'; errEl.classList.remove('hidden'); return; }
    if (senha !== senha2) { errEl.textContent = 'As senhas não coincidem.'; errEl.classList.remove('hidden'); return; }

    btn.textContent = 'Criando…';
    btn.disabled = true;

    try {
      const { data, error } = await _supabase.functions.invoke('create-user', {
        body: { email, password: senha, nome: v.nome, role: 'vendedora', vendedora_id: v.id }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast(`Acesso criado para ${v.nome}!`);
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

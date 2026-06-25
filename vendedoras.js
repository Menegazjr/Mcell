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
    // Busca vendedoras sempre; tenta list_users (Edge Function), fallback para profiles
    let vendedoras, users;
    try {
      [vendedoras, users] = await Promise.all([
        db.getVendedoras(),
        db.listUsers()
      ]);
    } catch (e) {
      // Fallback: usa profiles sem e-mail caso Edge Function falhe
      const [v, profiles] = await Promise.all([
        db.getVendedoras(),
        db.getAllProfiles()
      ]);
      vendedoras = v;
      users = profiles.map(p => ({
        id:         p.id,
        email:      '— (atualize a Edge Function)',
        nome:       p.nome,
        role:       p.role,
        is_master:  p.is_master || false,
        created_at: p.created_at
      }));
    }

    const admins    = users.filter(u => u.role === 'admin');
    const comAcesso = new Set(users.filter(u => u.vendedora_id).map(u => u.vendedora_id));
    const isMaster  = users.find(u => u.id === currentUser?.id)?.is_master || false;

    page.innerHTML = `
      <!-- ABAS -->
      <div class="tabs">
        <button class="tab-btn ${vendedorasTab==='vendedoras'?'active':''}" data-tab="vendedoras">
          👤 Vendedores <span class="tab-count">${vendedoras.length}</span>
        </button>
        <button class="tab-btn ${vendedorasTab==='admins'?'active':''}" data-tab="admins">
          🛡 Administradores <span class="tab-count">${admins.length}</span>
        </button>
      </div>

      <!-- PAINEL VENDEDORAS -->
      <div id="tab-vendedoras" class="tab-panel ${vendedorasTab==='vendedoras'?'active':''}">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">👤 Vendedores <span>${vendedoras.length} cadastradas</span></div>
            <button class="btn-primary btn-sm" id="btn-nova-vendedora">+ Novo Vendedor</button>
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
            ${renderTabelaAdmins(admins, isMaster)}
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
        toast(`Vendedor ${novoStatus === 'ativa' ? 'ativado' : 'desativado'}.`);
        renderVendedoras();
      });
    });

    document.querySelectorAll('.btn-del-vend').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir este vendedor? As vendas associadas serão mantidas.')) return;
        try {
          await db.deleteVendedora(btn.dataset.id);
          toast('Vendedor excluído.');
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

    document.querySelectorAll('.btn-edit-admin').forEach(btn => {
      btn.addEventListener('click', () => {
        abrirFormEditAdmin(btn.dataset.id, btn.dataset.nome, btn.dataset.email);
      });
    });

    document.querySelectorAll('.btn-del-admin').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Revogar acesso de administrador? O usuário perderá o acesso.')) return;
        try {
          const { data, error } = await _supabase.functions.invoke('create-user', {
            body: { action: 'delete', userId: btn.dataset.id }
          });
          if (error || data?.error) throw new Error(data?.error || error?.message);
          toast('Administrador removido.');
          renderVendedoras();
        } catch (err) {
          toast('Erro: ' + err.message, 'error');
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
      <p>Nenhum vendedor cadastrado ainda.</p>
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
function renderTabelaAdmins(admins, isMaster) {
  if (!admins.length) return `
    <div class="empty-state">
      <div class="icon">🛡</div>
      <p>Nenhum administrador cadastrado.</p>
    </div>`;

  const rows = admins.map(a => {
    const isMe     = a.id === currentUser?.id;
    const isTarget = a.is_master;
    // Master pode editar todos; admin normal só edita a si mesmo
    const podeEditar = isMaster || isMe;
    const podeRevogar = isMaster && !isTarget && !isMe;

    return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0">
            ${(a.nome||'A').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-weight:600;font-size:0.88rem">${a.nome || '—'}</div>
            <div style="font-size:0.75rem;color:var(--text2)">${a.email || '—'}</div>
          </div>
          ${isMe ? '<span class="badge badge-blue" style="font-size:0.68rem">Você</span>' : ''}
          ${isTarget ? '<span class="badge badge-yellow" style="font-size:0.68rem">Master</span>' : ''}
        </div>
      </td>
      <td><span class="badge badge-green">🛡 Admin</span></td>
      <td style="font-size:0.8rem;color:var(--text2)">${fmtDate(a.created_at?.split('T')[0])}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:nowrap">
          ${podeEditar ? `<button class="btn-ghost btn-sm btn-edit-admin" data-id="${a.id}" data-nome="${a.nome||''}" data-email="${a.email||''}">Editar</button>` : ''}
          ${podeRevogar ? `<button class="btn-danger btn-sm btn-del-admin" data-id="${a.id}">Revogar</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  return `
    <table>
      <thead>
        <tr><th>Nome / E-mail</th><th>Perfil</th><th>Desde</th><th>Ações</th></tr>
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
    <div class="modal-title">${isEdit ? 'Editar' : 'Novo'} Vendedor</div>
    <div class="modal-subtitle">${isEdit ? 'Altere os dados abaixo.' : 'Preencha os dados do novo vendedor.'}</div>
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
      toast(`Vendedor ${isEdit?'atualizado':'cadastrado'} com sucesso!`);
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
      <p>O vendedor poderá fazer login e acessar apenas seus próprios dados.</p>
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

// ── FORM EDITAR ADMIN ──────────────────────────
function abrirFormEditAdmin(userId, nomeAtual, emailAtual) {
  const isSelf  = userId === currentUser?.id;
  const isMasterUser = currentProfile?.is_master || false;

  openModal(`
    <div class="modal-title">✏️ Editar Administrador</div>
    <div class="modal-subtitle">Altere nome, e-mail ou senha.</div>
    <form id="form-edit-admin">
      <div class="form-grid">
        <div class="form-group form-full">
          <label>Nome *</label>
          <input type="text" id="ea-nome" value="${nomeAtual}" placeholder="Nome completo" required/>
        </div>
        <div class="form-group form-full">
          <label>E-mail *</label>
          <input type="email" id="ea-email" value="${emailAtual}" placeholder="email@exemplo.com" required/>
        </div>
        <div class="form-group">
          <label>Nova Senha <span style="color:var(--text2);font-weight:400">(deixe em branco para não alterar)</span></label>
          <input type="password" id="ea-senha" placeholder="Mínimo 6 caracteres"/>
        </div>
        <div class="form-group">
          <label>Confirmar Senha</label>
          <input type="password" id="ea-senha2" placeholder="Repita a senha"/>
        </div>
      </div>
      <div id="ea-error" class="login-error hidden"></div>
      <div class="form-actions">
        <button type="button" class="btn-ghost" id="btn-cancel-ea">Cancelar</button>
        <button type="submit" class="btn-primary">Salvar</button>
      </div>
    </form>
  `);

  document.getElementById('btn-cancel-ea').addEventListener('click', closeModal);

  document.getElementById('form-edit-admin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn    = e.target.querySelector('button[type=submit]');
    const errEl  = document.getElementById('ea-error');
    const nome   = document.getElementById('ea-nome').value.trim();
    const email  = document.getElementById('ea-email').value.trim();
    const senha  = document.getElementById('ea-senha').value;
    const senha2 = document.getElementById('ea-senha2').value;

    errEl.classList.add('hidden');

    if (senha && senha.length < 6) {
      errEl.textContent = 'A senha deve ter pelo menos 6 caracteres.';
      errEl.classList.remove('hidden'); return;
    }
    if (senha && senha !== senha2) {
      errEl.textContent = 'As senhas não coincidem.';
      errEl.classList.remove('hidden'); return;
    }

    btn.textContent = 'Salvando…';
    btn.disabled = true;

    try {
      // Atualizar nome no profile
      const { error: nomeErr } = await _supabase
        .from('profiles').update({ nome }).eq('id', userId);
      if (nomeErr) throw nomeErr;

      // Atualizar e-mail se mudou
      if (email !== emailAtual) {
        const { data, error } = await _supabase.functions.invoke('create-user', {
          body: { action: 'update_email', userId, email }
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
      }

      // Atualizar senha se preenchida
      if (senha) {
        const { data, error } = await _supabase.functions.invoke('create-user', {
          body: { action: 'update_password', userId, password: senha }
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
      }

      // Se editou a si mesmo, atualiza localmente
      if (isSelf && currentProfile) {
        currentProfile.nome = nome;
        document.getElementById('user-name').textContent = nome;
        document.getElementById('user-avatar').textContent = nome.charAt(0).toUpperCase();
      }

      toast('Administrador atualizado com sucesso!');
      closeModal();
      vendedorasTab = 'admins';
      renderVendedoras();
    } catch (err) {
      errEl.textContent = 'Erro: ' + err.message;
      errEl.classList.remove('hidden');
      btn.textContent = 'Salvar';
      btn.disabled = false;
    }
  });
}

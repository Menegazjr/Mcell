// ═══════════════════════════════════════════════
// MCELL — MEU PERFIL
// Todos os usuários podem alterar nome e senha
// ═══════════════════════════════════════════════

async function renderPerfil() {
  const page = document.getElementById('page-perfil');
  page.innerHTML = `<div class="spinner"></div>`;

  try {
    const profile = currentProfile;
    const user    = currentUser;
    const nome    = profile?.nome || user?.email?.split('@')[0] || '';
    const email   = user?.email || '';
    const role    = profile?.role === 'admin' ? 'Administrador' : 'Vendedora';
    const inicial = nome.charAt(0).toUpperCase();

    page.innerHTML = `
      <!-- HEADER PERFIL -->
      <div class="perfil-hero">
        <div class="perfil-avatar">${inicial}</div>
        <div>
          <div class="perfil-nome">${nome}</div>
          <div class="perfil-email">${email}</div>
          <span class="badge ${profile?.role==='admin'?'badge-blue':'badge-green'}">${role}</span>
        </div>
      </div>

      <!-- DADOS PESSOAIS -->
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-title" style="margin-bottom:16px">👤 Dados Pessoais</div>
        <form id="form-dados">
          <div class="form-grid">
            <div class="form-group form-full">
              <label>Nome de exibição *</label>
              <input type="text" id="p-nome" value="${nome}" placeholder="Seu nome"/>
            </div>
            <div class="form-group form-full">
              <label>E-mail</label>
              <input type="email" value="${email}" disabled
                style="opacity:0.5;cursor:not-allowed" title="O e-mail não pode ser alterado aqui"/>
              <small style="color:var(--text2);font-size:0.75rem;margin-top:4px;display:block">
                O e-mail só pode ser alterado pelo administrador
              </small>
            </div>
          </div>
          <div id="dados-success" class="perfil-msg success hidden">✓ Nome atualizado com sucesso!</div>
          <div id="dados-error" class="perfil-msg error hidden"></div>
          <div class="form-actions">
            <button type="submit" class="btn-primary">Salvar Nome</button>
          </div>
        </form>
      </div>

      <!-- TROCAR SENHA -->
      <div class="panel">
        <div class="panel-title" style="margin-bottom:16px">🔒 Trocar Senha</div>
        <form id="form-senha">
          <div class="form-grid">
            <div class="form-group form-full">
              <label>Nova Senha *</label>
              <input type="password" id="p-nova" placeholder="Mínimo 6 caracteres"/>
            </div>
            <div class="form-group form-full">
              <label>Confirmar Nova Senha *</label>
              <input type="password" id="p-nova2" placeholder="Repita a nova senha"/>
            </div>
          </div>
          <div class="perfil-dica">
            💡 Use uma senha com letras, números e símbolos para maior segurança.
          </div>
          <div id="senha-success" class="perfil-msg success hidden">✓ Senha alterada com sucesso!</div>
          <div id="senha-error" class="perfil-msg error hidden"></div>
          <div class="form-actions">
            <button type="submit" class="btn-primary">Alterar Senha</button>
          </div>
        </form>
      </div>
    `;

    // ── SALVAR NOME ──────────────────────────────
    document.getElementById('form-dados').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn  = e.target.querySelector('button[type=submit]');
      const ok   = document.getElementById('dados-success');
      const err  = document.getElementById('dados-error');
      const nome = document.getElementById('p-nome').value.trim();

      ok.classList.add('hidden');
      err.classList.add('hidden');

      if (!nome) {
        err.textContent = 'Informe um nome.';
        err.classList.remove('hidden'); return;
      }

      btn.textContent = 'Salvando…';
      btn.disabled = true;

      try {
        const { error } = await _supabase
          .from('profiles')
          .update({ nome })
          .eq('id', currentUser.id);
        if (error) throw error;

        // Atualiza localmente
        if (currentProfile) currentProfile.nome = nome;
        document.getElementById('user-name').textContent = nome;
        document.getElementById('user-avatar').textContent = nome.charAt(0).toUpperCase();

        ok.classList.remove('hidden');
        toast('Nome atualizado!');
        renderPerfil();
      } catch (err2) {
        err.textContent = 'Erro: ' + err2.message;
        err.classList.remove('hidden');
      } finally {
        btn.textContent = 'Salvar Nome';
        btn.disabled = false;
      }
    });

    // ── TROCAR SENHA ─────────────────────────────
    document.getElementById('form-senha').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn   = e.target.querySelector('button[type=submit]');
      const ok    = document.getElementById('senha-success');
      const err   = document.getElementById('senha-error');
      const nova  = document.getElementById('p-nova').value;
      const nova2 = document.getElementById('p-nova2').value;

      ok.classList.add('hidden');
      err.classList.add('hidden');

      if (nova.length < 6) {
        err.textContent = 'A senha deve ter pelo menos 6 caracteres.';
        err.classList.remove('hidden'); return;
      }
      if (nova !== nova2) {
        err.textContent = 'As senhas não coincidem.';
        err.classList.remove('hidden'); return;
      }

      btn.textContent = 'Alterando…';
      btn.disabled = true;

      try {
        const { error } = await _supabase.auth.updateUser({ password: nova });
        if (error) throw error;

        ok.classList.remove('hidden');
        document.getElementById('p-nova').value  = '';
        document.getElementById('p-nova2').value = '';
        toast('Senha alterada com sucesso!');
      } catch (err2) {
        err.textContent = 'Erro: ' + err2.message;
        err.classList.remove('hidden');
      } finally {
        btn.textContent = 'Alterar Senha';
        btn.disabled = false;
      }
    });

  } catch (err) {
    page.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>${err.message}</p></div>`;
  }
}

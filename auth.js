// ═══════════════════════════════════════════════
// MCELL — AUTH + FIRST-ACCESS SETUP
// ═══════════════════════════════════════════════

let currentUser = null;
let currentProfile = null;

// ── INIT ───────────────────────────────────────
async function initAuth() {
  // Check active session first
  const { data: { session } } = await _supabase.auth.getSession();

  if (session?.user) {
    await loadUserProfile(session.user);
    showApp();
  } else {
    // Check if any admin exists before showing login
    const hasAdmin = await checkAdminExists();
    if (hasAdmin) {
      showLogin();
    } else {
      showSetup();
    }
  }

  _supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      await loadUserProfile(session.user);
      showApp();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      showLogin();
    }
  });
}

async function checkAdminExists() {
  try {
    const { data, error } = await _supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1);
    if (error) return true; // on error, assume exists (safe fallback)
    return (data && data.length > 0);
  } catch {
    return true;
  }
}

// ── SCREENS ────────────────────────────────────
function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initApp();
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  // Restaurar e-mail salvo
  const saved = localStorage.getItem('mcell_email');
  if (saved) {
    document.getElementById('login-email').value = saved;
    document.getElementById('login-remember').checked = true;
  }
}

function showSetup() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('setup-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  // Reset to step 1
  goToSetupStep(1);
}

// ── LOAD PROFILE ───────────────────────────────
async function loadUserProfile(user) {
  currentUser = user;
  try {
    currentProfile = await db.getProfile(user.id);
  } catch {
    currentProfile = null;
  }

  const name    = currentProfile?.nome || user.email?.split('@')[0] || 'Usuário';
  const role    = currentProfile?.role || 'vendedora';
  const initial = name.charAt(0).toUpperCase();

  document.getElementById('user-name').textContent  = name;
  document.getElementById('user-role').textContent  = role === 'admin' ? 'Administrador' : 'Vendedora';
  document.getElementById('user-avatar').textContent = initial;

  const adminOnly = role === 'admin';
  document.getElementById('nav-vendedoras').style.display = adminOnly ? '' : 'none';
  document.getElementById('nav-metas').style.display      = adminOnly ? '' : 'none';
  document.getElementById('nav-banco').style.display      = adminOnly ? '' : 'none';

  // Expor is_master globalmente
  window._isMaster = currentProfile?.is_master || false;
}

// ══════════════════════════════════════════════
// SETUP FLOW
// ══════════════════════════════════════════════
let _setupEmail = '';
let _setupPassword = '';

function goToSetupStep(n) {
  [1,2,3].forEach(i => {
    document.getElementById(`setup-step-${i}`).classList.toggle('hidden', i !== n);
    const stepEl = document.getElementById(`step-${i}`);
    if (stepEl) {
      stepEl.classList.toggle('active', i === n);
      stepEl.classList.toggle('done', i < n);
    }
  });
}

// STEP 1 — email + senha
document.getElementById('btn-setup-1').addEventListener('click', () => {
  const email = document.getElementById('setup-email').value.trim();
  const pass  = document.getElementById('setup-password').value;
  const pass2 = document.getElementById('setup-password2').value;
  const err   = document.getElementById('setup-error-1');

  err.classList.add('hidden');

  if (!email || !pass) {
    err.textContent = 'Preencha e-mail e senha.';
    err.classList.remove('hidden'); return;
  }
  if (pass.length < 6) {
    err.textContent = 'A senha deve ter pelo menos 6 caracteres.';
    err.classList.remove('hidden'); return;
  }
  if (pass !== pass2) {
    err.textContent = 'As senhas não coincidem.';
    err.classList.remove('hidden'); return;
  }

  _setupEmail    = email;
  _setupPassword = pass;
  goToSetupStep(2);
});

// STEP 2 — nome + criar conta
document.getElementById('btn-setup-2').addEventListener('click', async () => {
  const nome = document.getElementById('setup-nome').value.trim();
  const err  = document.getElementById('setup-error-2');
  const btn  = document.getElementById('btn-setup-2');

  err.classList.add('hidden');
  if (!nome) {
    err.textContent = 'Informe seu nome.';
    err.classList.remove('hidden'); return;
  }

  btn.textContent = 'Criando conta…';
  btn.disabled = true;

  try {
    // 1. Create auth user
    const { data: signUpData, error: signUpErr } = await _supabase.auth.signUp({
      email:    _setupEmail,
      password: _setupPassword,
      options: { data: { nome, role: 'admin' } }
    });
    if (signUpErr) throw signUpErr;

    const userId = signUpData.user?.id;
    if (!userId) throw new Error('Usuário não criado. Verifique se confirmação de e-mail está desativada no Supabase.');

    // 2. Upsert profile as admin
    const { error: profErr } = await _supabase.from('profiles').upsert({
      id:   userId,
      nome: nome,
      role: 'admin'
    });
    if (profErr) throw profErr;

    // 3. Show success
    goToSetupStep(3);

  } catch (err2) {
    err.textContent = err2.message || 'Erro ao criar conta.';
    err.classList.remove('hidden');
    btn.textContent = 'Criar Administrador →';
    btn.disabled = false;
  }
});

// STEP 3 — go to login
document.getElementById('btn-setup-done').addEventListener('click', () => {
  // Pre-fill email on login screen
  document.getElementById('login-email').value = _setupEmail;
  showLogin();
});

// ══════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════
document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('btn-login');

  errEl.classList.add('hidden');
  if (!email || !pass) {
    errEl.textContent = 'Preencha e-mail e senha.';
    errEl.classList.remove('hidden'); return;
  }

  btn.textContent = 'Entrando…';
  btn.disabled = true;

  // Lembrar e-mail
  const remember = document.getElementById('login-remember')?.checked;
  if (remember) {
    localStorage.setItem('mcell_email', email);
  } else {
    localStorage.removeItem('mcell_email');
  }

  const { error } = await _supabase.auth.signInWithPassword({ email, password: pass });

  if (error) {
    errEl.textContent = 'E-mail ou senha incorretos.';
    errEl.classList.remove('hidden');
    btn.textContent = 'Entrar';
    btn.disabled = false;
  }
});

document.getElementById('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-login').click();
});

// ── LOGOUT ─────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', async () => {
  await _supabase.auth.signOut();
});

// ── MODAL CLOSE ────────────────────────────────
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

function isAdmin() {
  return currentProfile?.role === 'admin';
}
function getVendedoraId() {
  return currentProfile?.vendedora_id || null;
}

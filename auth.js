// ═══════════════════════════════════════════════
// MCELL — AUTH
// ═══════════════════════════════════════════════

let currentUser = null;
let currentProfile = null;

async function initAuth() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (session?.user) {
    await loadUserProfile(session.user);
    showApp();
  } else {
    showLogin();
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

async function loadUserProfile(user) {
  currentUser = user;
  try {
    currentProfile = await db.getProfile(user.id);
  } catch {
    currentProfile = null;
  }

  // Update UI
  const name = currentProfile?.nome || user.email?.split('@')[0] || 'Usuário';
  const role = currentProfile?.role || 'vendedora';
  const initial = name.charAt(0).toUpperCase();

  document.getElementById('user-name').textContent = name;
  document.getElementById('user-role').textContent =
    role === 'admin' ? 'Administrador' : 'Vendedora';
  document.getElementById('user-avatar').textContent = initial;

  // Hide admin-only nav items for vendors
  const isAdmin = role === 'admin';
  document.getElementById('nav-vendedoras').style.display = isAdmin ? '' : 'none';
  document.getElementById('nav-metas').style.display = isAdmin ? '' : 'none';
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initApp();
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

// ── LOGIN ──────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', async () => {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('btn-login');

  errEl.classList.add('hidden');
  if (!email || !password) {
    errEl.textContent = 'Preencha e-mail e senha.';
    errEl.classList.remove('hidden');
    return;
  }

  btn.textContent = 'Entrando…';
  btn.disabled = true;

  const { error } = await _supabase.auth.signInWithPassword({ email, password });

  if (error) {
    errEl.textContent = 'E-mail ou senha incorretos.';
    errEl.classList.remove('hidden');
    btn.textContent = 'Entrar';
    btn.disabled = false;
  }
});

// Allow Enter key on password
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

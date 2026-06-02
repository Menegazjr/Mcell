// ═══════════════════════════════════════════════
// MCELL — APP ORCHESTRATOR
// ═══════════════════════════════════════════════

function initApp() {
  buildMonthSelector();
  setupNavigation();
  setupSidebar();
  navigateTo('dashboard');
}

// ── MONTH SELECTOR ─────────────────────────────
function buildMonthSelector() {
  const sel = document.getElementById('month-select');
  sel.innerHTML = '';
  const now = new Date();

  // Last 12 months + next 3
  for (let offset = -12; offset <= 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const m = d.getMonth() + 1;
    const a = d.getFullYear();
    const opt = document.createElement('option');
    opt.value = `${m}-${a}`;
    opt.textContent = `${mesToNome(m)} ${a}`;
    if (m === currentMes && a === currentAno) opt.selected = true;
    sel.appendChild(opt);
  }

  sel.addEventListener('change', () => {
    const [m, a] = sel.value.split('-').map(Number);
    currentMes = m;
    currentAno = a;
    refreshCurrentPage();
  });
}

// ── NAVIGATION ─────────────────────────────────
let currentPage = 'dashboard';

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
      // Close sidebar on mobile
      if (window.innerWidth < 768) closeSidebar();
    });
  });
}

function navigateTo(page) {
  currentPage = page;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(i => {
    i.classList.toggle('active', i.dataset.page === page);
  });

  // Update page visibility
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');

  // Update title
  const titles = {
    dashboard:  'Dashboard',
    vendas:     'Registrar Venda',
    vendedoras: 'Vendedoras',
    metas:      'Metas',
    relatorios: 'Relatórios'
  };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  // Render page
  refreshCurrentPage();
}

function refreshCurrentPage() {
  switch(currentPage) {
    case 'dashboard':  renderDashboard();  break;
    case 'vendas':     renderVendas();     break;
    case 'vendedoras': renderVendedoras(); break;
    case 'metas':      renderMetas();      break;
    case 'relatorios': renderRelatorios(); break;
  }
}

// ── SIDEBAR MOBILE ─────────────────────────────
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';
  document.body.appendChild(overlay);

  document.getElementById('menu-toggle').addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('active');
  });

  document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ── INIT ON LOAD ───────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initAuth();
});

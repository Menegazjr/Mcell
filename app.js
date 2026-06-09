// ═══════════════════════════════════════════════
// MCELL — APP ORCHESTRATOR
// ═══════════════════════════════════════════════

function initApp() {
  buildMonthSelector();
  setupNavigation();
  setupSidebar();

  // Vendedoras vão direto para Meu Desempenho
  const startPage = isAdmin() ? 'dashboard' : 'desempenho';
  navigateTo(startPage);

  // Controla visibilidade do menu "Meu Desempenho"
  // Admin: pode ver via seletor dentro da página
  // Vendedora: vê sempre
  const navDesemp = document.getElementById('nav-desempenho');
  if (navDesemp) navDesemp.style.display = '';
}

// ── MONTH SELECTOR ─────────────────────────────
function buildMonthSelector() {
  const sel = document.getElementById('month-select');
  sel.innerHTML = '';
  const now = new Date();

  // Início fixo: Junho 2026
  const inicio = new Date(2026, 5, 1);

  // Fim: mês atual + 1 (cresce automaticamente todo mês)
  const fim = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  let cursor = new Date(inicio);
  while (cursor <= fim) {
    const m = cursor.getMonth() + 1;
    const a = cursor.getFullYear();
    const opt = document.createElement('option');
    opt.value = `${m}-${a}`;
    opt.textContent = `${mesToNome(m)} ${a}`;
    if (m === currentMes && a === currentAno) opt.selected = true;
    sel.appendChild(opt);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  sel.addEventListener('change', () => {
    const [m, a] = sel.value.split('-').map(Number);
    currentMes = m;
    currentAno = a;
    // Resetar vendedora selecionada no desempenho ao trocar mês
    if (typeof _selectedVendedoraDesemp !== 'undefined') {
      _selectedVendedoraDesemp = null;
    }
    refreshCurrentPage();
  });
}

// ── NAVIGATION ─────────────────────────────────
let currentPage = 'dashboard';
let _rendering  = false;   // evita render duplo
let _renderTimer = null;   // timeout de segurança

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
      if (window.innerWidth < 768) closeSidebar();
    });
  });
}

function navigateTo(page) {
  currentPage = page;

  document.querySelectorAll('.nav-item').forEach(i => {
    i.classList.toggle('active', i.dataset.page === page);
  });

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const activePage = document.getElementById(`page-${page}`);
  activePage.classList.add('active');

  // Sempre volta ao topo ao trocar de página
  window.scrollTo({ top: 0, behavior: 'instant' });
  activePage.scrollTop = 0;
  document.querySelector('.main-content').scrollTop = 0;

  const titles = {
    dashboard:   'Dashboard',
    vendas:      'Registrar Venda',
    vendedoras:  'Vendedoras',
    metas:       'Metas',
    relatorios:  'Relatórios',
    desempenho:  'Meu Desempenho',
    banco:       'Uso do Banco',
    perfil:      'Meu Perfil'
  };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  refreshCurrentPage();
}

function refreshCurrentPage() {
  // Cancela render anterior se ainda estiver rodando
  clearTimeout(_renderTimer);

  // Timeout de segurança: se após 15s a página ainda tiver spinner, mostra erro
  _renderTimer = setTimeout(() => {
    const page = document.getElementById(`page-${currentPage}`);
    if (page && page.querySelector('.spinner')) {
      page.innerHTML = `
        <div class="empty-state">
          <div class="icon">⚡</div>
          <p>A conexão demorou muito.<br>
          <button class="btn-primary btn-sm" style="margin-top:12px"
            onclick="refreshCurrentPage()">Tentar novamente</button></p>
        </div>`;
    }
  }, 15000);

  switch(currentPage) {
    case 'dashboard':  renderDashboard();  break;
    case 'vendas':     renderVendas();     break;
    case 'vendedoras': renderVendedoras(); break;
    case 'metas':      renderMetas();      break;
    case 'relatorios': renderRelatorios(); break;
    case 'desempenho': renderDesempenho(); break;
    case 'banco':      renderBanco();      break;
    case 'perfil':     renderPerfil();     break;
  }
}

// ── SIDEBAR MOBILE ─────────────────────────────
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');

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

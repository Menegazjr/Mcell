// ═══════════════════════════════════════════════
// MCELL — SERVICE WORKER
// Atualiza automaticamente quando há nova versão
// ═══════════════════════════════════════════════

// Mude esse número a cada deploy para forçar atualização
const CACHE_VERSION = 'mcell-v5';

const STATIC_FILES = [
  '/Mcell/',
  '/Mcell/index.html',
  '/Mcell/style.css',
  '/Mcell/app.js',
  '/Mcell/auth.js',
  '/Mcell/supabase-config.js',
  '/Mcell/dashboard.js',
  '/Mcell/vendas.js',
  '/Mcell/vendedoras.js',
  '/Mcell/metas.js',
  '/Mcell/relatorios.js',
  '/Mcell/desempenho.js',
  '/Mcell/banco.js',
  '/Mcell/perfil.js',
  '/Mcell/logomcell.png',
  '/Mcell/icon-pwa.png',
];

// ── INSTALL ────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      Promise.allSettled(
        STATIC_FILES.map(url =>
          cache.add(url).catch(() => console.warn('Cache falhou:', url))
        )
      )
    // Força ativação imediata sem esperar fechar abas
    ).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — limpa caches antigos ───────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => {
          console.log('Removendo cache antigo:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ──────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase sempre vai para a rede
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ error: 'Sem conexão com o banco de dados.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // HTML: network first — sempre tenta buscar versão mais nova
  // Se falhar (offline), usa o cache
  if (event.request.destination === 'document' ||
      event.request.url.includes('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache =>
            cache.put(event.request, clone)
          );
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // JS e CSS: network first também, para pegar atualizações
  if (event.request.destination === 'script' ||
      event.request.destination === 'style') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache =>
            cache.put(event.request, clone)
          );
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Imagens e resto: cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache =>
            cache.put(event.request, clone)
          );
        }
        return response;
      }).catch(() => caches.match('/Mcell/index.html'));
    })
  );
});

// ── MENSAGEM — força reload quando há update ──
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

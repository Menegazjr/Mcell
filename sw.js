// ═══════════════════════════════════════════════
// MCELL — SERVICE WORKER
// Cache de arquivos estáticos para abertura offline
// ═══════════════════════════════════════════════

const CACHE_NAME = 'mcell-v1';

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
  '/Mcell/logomcell.png',
  '/Mcell/icon-pwa.png',
  // Libs externas
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

// ── INSTALL — faz cache de tudo ────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_FILES.map(url =>
          cache.add(url).catch(() => console.warn('Cache falhou:', url))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — limpa caches antigos ───────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH — serve cache, tenta rede ───────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Requisições ao Supabase sempre vão para a rede
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

  // Arquivos estáticos: cache first, rede como fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Salva no cache se for resposta válida
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline e não tem cache: retorna o index.html
        if (event.request.destination === 'document') {
          return caches.match('/Mcell/index.html');
        }
      });
    })
  );
});

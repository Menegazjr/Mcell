// ═══════════════════════════════════════════════
// MCELL — SERVICE WORKER v13
// Cache estático + network-first para JS/CSS/HTML
// Não bloqueia nunca — sempre retorna algo
// ═══════════════════════════════════════════════

const CACHE_VERSION = 'mcell-v22';

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
  '/Mcell/favicon.ico',
];

// ── INSTALL ────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      Promise.allSettled(
        STATIC_FILES.map(url =>
          cache.add(url).catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ───────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ──────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase: sempre rede, nunca cache, sem bloquear
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.io')) {
    event.respondWith(
      Promise.race([
        fetch(event.request),
        // Timeout de 12s — nunca trava indefinidamente
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 12000)
        )
      ]).catch(() =>
        new Response(
          JSON.stringify({ error: 'Conexão lenta ou sem internet.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Fontes e CDNs externos: cache first, sem bloquear
  if (!url.hostname.includes('menegazjr.github.io')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(res => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
            }
            return res;
          })
          .catch(() => new Response('', { status: 408 }));
      })
    );
    return;
  }

  // Arquivos do app: network first com fallback para cache
  // HTML/JS/CSS sempre tentam rede primeiro para pegar atualizações
  event.respondWith(
    Promise.race([
      fetch(event.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
        }
        return res;
      }),
      // Timeout de 8s para arquivos do app
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      )
    ]).catch(() =>
      // Se rede falhar ou timeout: usa cache
      caches.match(event.request).then(cached =>
        cached || caches.match('/Mcell/index.html')
      )
    )
  );
});

// ── MENSAGEM ───────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

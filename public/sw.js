// Cache version — 빌드 시점에 자동 갱신되어야 함
// (main.tsx가 sw.js를 재등록하면 브라우저가 자동으로 새 SW 감지)
const CACHE_NAME = 'sms-app-' + (self.registration?.scope || Date.now());

self.addEventListener('install', (event) => {
  // 새 SW 즉시 활성화 (대기 없이)
  self.skipWaiting();
});

// 클라이언트에서 SKIP_WAITING 메시지 수신 시 즉시 교체
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 모든 이전 캐시 삭제
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      // 모든 클라이언트에 즉시 제어권 획득
      await self.clients.claim();
      // 열려있는 모든 탭에 업데이트 알림
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET 요청만 처리
  if (req.method !== 'GET') return;

  // HTML 페이지: Network-first (항상 최신 버전 시도)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() =>
        caches.match('/index.html').then((m) => m || new Response('', { status: 504 }))
      )
    );
    return;
  }

  // 해시가 포함된 정적 자산 (JS/CSS with hash): Cache-first
  // Vite 번들 파일은 파일명에 해시가 있어 안전
  const url = new URL(req.url);
  const isHashedAsset = /\/assets\/.*-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|jpg|svg)$/.test(url.pathname);

  if (isHashedAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 그 외 (API, 외부 리소스 등): Network-first, 실패 시 캐시
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((m) => m || new Response('', { status: 504 })))
  );
});

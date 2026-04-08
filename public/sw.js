// TODOPEDIA service worker — minimal install/offline
// 정책:
//  - 정적 에셋 (/_next/static, /ui/, /icons/, /favicon, 폰트): cache-first
//  - HTML 네비게이션: network-first → 실패 시 캐시된 마지막 응답 → 그것도 없으면 /offline
//  - 그 외 (Supabase API, /api/*, RSC 요청 등): 패스스루 (가로채지 않음)

const VERSION = "v1";
const STATIC_CACHE = `todopedia-static-${VERSION}`;
const PAGE_CACHE = `todopedia-pages-${VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/ui/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/favicon") ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 외부(Supabase 등) 패스스루
  if (url.pathname.startsWith("/api/")) return; // API 패스스루

  // 정적 에셋: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, clone));
            }
            return res;
          })
      )
    );
    return;
  }

  // 페이지 네비게이션: network-first → cache → offline
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const clone = fresh.clone();
          caches.open(PAGE_CACHE).then((c) => c.put(req, clone));
          return fresh;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          return (await caches.match(OFFLINE_URL)) || Response.error();
        }
      })()
    );
  }
});

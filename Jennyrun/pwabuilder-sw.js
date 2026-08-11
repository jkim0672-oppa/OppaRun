// Jenny Run Pro - Service Worker

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

// [수정] 배포할 때마다 이 버전 문자열을 올려주면, activate 단계에서 이전 캐시를
// 확실히 지워줍니다. (v1 -> v2)
const CACHE = "jennyrun-v2";
const offlineFallbackPage = "index.html";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// 설치 시 index.html 캐시
// [수정] cache.add()는 내부적으로 fetch()를 쓰는데, 옵션을 안 주면 브라우저/CDN의
// HTTP 캐시(GitHub Pages/Fastly의 Cache-Control)를 그대로 존중해서 방금 배포한
// 새 파일이 아니라 예전 캐시된 응답을 그대로 저장해버릴 수 있었음.
// fetch()로 직접 { cache: 'no-store' }를 걸어 강제로 네트워크에서 새로 받아온 뒤
// cache.put()으로 저장하도록 변경.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const freshResponse = await fetch(offlineFallbackPage, { cache: 'no-store' });
      await cache.put(offlineFallbackPage, freshResponse);
    })()
  );
  self.skipWaiting();
});

// 새 SW 활성화 시 이전 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preloadResp = await event.preloadResponse;
        if (preloadResp) return preloadResp;

        // [수정] 여기도 옵션 없는 fetch()라 CDN/브라우저 HTTP 캐시를 그대로 탈 수 있었음.
        // no-store로 강제해서 항상 최신 index.html을 받아오도록 수정.
        const networkResp = await fetch(event.request, { cache: 'no-store' });
        return networkResp;
      } catch (error) {
        const cache = await caches.open(CACHE);
        const cachedResp = await cache.match(offlineFallbackPage);
        return cachedResp;
      }
    })());
  }
});

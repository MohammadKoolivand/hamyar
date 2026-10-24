/* global self, caches, URL, fetch */
const CACHE = "hamyar-next-eab74c91afb2";
const SHELL = ["/","/_next/static/GZY_cEGmb-owUoIhqV3du/_buildManifest.js","/_next/static/GZY_cEGmb-owUoIhqV3du/_clientMiddlewareManifest.js","/_next/static/GZY_cEGmb-owUoIhqV3du/_ssgManifest.js","/_next/static/chunks/0cz1d0mv5g_q7.js","/_next/static/chunks/0r-yur70-ku2o.js","/_next/static/chunks/0umf92h1sb77c.js","/_next/static/chunks/1srqfg0fatwaz.css","/_next/static/chunks/2khxl0v1q4i6n.js","/_next/static/chunks/37ia9y7r7q2qo.js","/_next/static/chunks/3cfn99dbrcvvp.js","/_next/static/chunks/turbopack-2c3mg3r-05n1w.js","/_next/static/media/PersianLocal.p.1xhvlkhmphpns.ttf","/_next/static/media/Poppins_Regular.p.256lsa027nxlw.ttf","/icon.svg","/manifest.webmanifest"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
});
// Authenticated responses and student data must never enter Cache Storage.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
    return;
  }
  if (SHELL.includes(url.pathname))
    event.respondWith(
      caches
        .match(event.request, { ignoreVary: true })
        .then((cached) => cached || fetch(event.request)),
    );
});

/* global self, caches, URL, fetch */
const CACHE = "hamyar-next-94062803c4ea";
const SHELL = ["/","/_next/static/Ne_rbbtN061vs3e34Z1Qn/_buildManifest.js","/_next/static/Ne_rbbtN061vs3e34Z1Qn/_ssgManifest.js","/_next/static/chunks/4bd1b696-c7408084347438ae.js","/_next/static/chunks/774-0cab851c1b14f1e0.js","/_next/static/chunks/794-3c1567673e1f8cb7.js","/_next/static/chunks/991-fa4fb6a53818b527.js","/_next/static/chunks/d3ac728e-5ec6e712818d6bbc.js","/_next/static/chunks/framework-ea4f97ca039bd777.js","/_next/static/chunks/main-6bbff23ea139b22e.js","/_next/static/chunks/main-app-bd8af9883e0eb318.js","/_next/static/chunks/polyfills-42372ed130431b0a.js","/_next/static/chunks/webpack-567771a42e268cd4.js","/_next/static/css/1eb48c16ea0346f7.css","/_next/static/media/4b4ebe20759bdbf2.p.ttf","/_next/static/media/fcf6bd7943ceb169.p.ttf","/_next/static/chunks/app/layout-2355d78d1334fd1f.js","/_next/static/chunks/app/page-876b1a531ec60c9d.js","/_next/static/chunks/app/[section]/page-e7a5f19d8281ddc7.js","/_next/static/chunks/app/_global-error/page-bc9a772f5cd173f6.js","/_next/static/chunks/app/_not-found/page-6dc43050004ab4f5.js","/_next/static/chunks/app/api/[...path]/route-bc9a772f5cd173f6.js","/_next/static/chunks/next/dist/client/components/builtin/app-error-bc9a772f5cd173f6.js","/_next/static/chunks/next/dist/client/components/builtin/forbidden-bc9a772f5cd173f6.js","/_next/static/chunks/next/dist/client/components/builtin/global-error-f636d659ec9f79a5.js","/_next/static/chunks/next/dist/client/components/builtin/not-found-bc9a772f5cd173f6.js","/_next/static/chunks/next/dist/client/components/builtin/unauthorized-bc9a772f5cd173f6.js","/icon.svg","/manifest.webmanifest"];
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

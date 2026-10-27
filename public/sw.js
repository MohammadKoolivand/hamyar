/* global self, caches, URL, fetch */
const CACHE = "hamyar-next-12969e1e7d2a";
const SHELL = ["/","/_next/static/UZsx63v4RvTNLp8RaubVu/_buildManifest.js","/_next/static/UZsx63v4RvTNLp8RaubVu/_ssgManifest.js","/_next/static/chunks/4bd1b696-c7408084347438ae.js","/_next/static/chunks/774-6e187c486cbca72e.js","/_next/static/chunks/794-3c1567673e1f8cb7.js","/_next/static/chunks/942-129fe6f597a5d9c2.js","/_next/static/chunks/d3ac728e-5ec6e712818d6bbc.js","/_next/static/chunks/framework-ea4f97ca039bd777.js","/_next/static/chunks/main-6bbff23ea139b22e.js","/_next/static/chunks/main-app-bd8af9883e0eb318.js","/_next/static/chunks/polyfills-42372ed130431b0a.js","/_next/static/chunks/webpack-567771a42e268cd4.js","/_next/static/css/79cd272266d11c57.css","/_next/static/media/4b4ebe20759bdbf2.p.ttf","/_next/static/media/fcf6bd7943ceb169.p.ttf","/_next/static/chunks/app/layout-2355d78d1334fd1f.js","/_next/static/chunks/app/page-846d05003991eaec.js","/_next/static/chunks/app/[section]/page-b42c605f31b90d7d.js","/_next/static/chunks/app/_global-error/page-79ce168682fdbc8c.js","/_next/static/chunks/app/_not-found/page-6dc43050004ab4f5.js","/_next/static/chunks/app/verify-email/page-79ce168682fdbc8c.js","/_next/static/chunks/app/api/[...path]/route-79ce168682fdbc8c.js","/_next/static/chunks/next/dist/client/components/builtin/app-error-79ce168682fdbc8c.js","/_next/static/chunks/next/dist/client/components/builtin/forbidden-79ce168682fdbc8c.js","/_next/static/chunks/next/dist/client/components/builtin/global-error-f636d659ec9f79a5.js","/_next/static/chunks/next/dist/client/components/builtin/not-found-79ce168682fdbc8c.js","/_next/static/chunks/next/dist/client/components/builtin/unauthorized-79ce168682fdbc8c.js","/icon.svg","/manifest.webmanifest"];
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

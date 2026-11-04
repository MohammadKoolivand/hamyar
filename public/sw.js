/* global self, caches, URL, fetch */
const CACHE = "hamyar-next-fd52266a7cb7";
const SHELL = ["/","/_next/static/AOsKJCl9XOJtGl3FUTtCG/_buildManifest.js","/_next/static/AOsKJCl9XOJtGl3FUTtCG/_ssgManifest.js","/_next/static/chunks/4bd1b696-c7408084347438ae.js","/_next/static/chunks/727-5ea3035c4282dac1.js","/_next/static/chunks/774-7e5db1fd7b11b89b.js","/_next/static/chunks/794-3c1567673e1f8cb7.js","/_next/static/chunks/d3ac728e-5ec6e712818d6bbc.js","/_next/static/chunks/framework-ea4f97ca039bd777.js","/_next/static/chunks/main-6bbff23ea139b22e.js","/_next/static/chunks/main-app-bd8af9883e0eb318.js","/_next/static/chunks/polyfills-42372ed130431b0a.js","/_next/static/chunks/webpack-1d3e178095c0f8ba.js","/_next/static/css/13bf3e30b5050e9c.css","/_next/static/css/dbdba195f13932a1.css","/_next/static/media/4b4ebe20759bdbf2.p.ttf","/_next/static/media/KaTeX_AMS-Regular.1608a09b.woff","/_next/static/media/KaTeX_AMS-Regular.4aafdb68.ttf","/_next/static/media/KaTeX_AMS-Regular.a79f1c31.woff2","/_next/static/media/KaTeX_Caligraphic-Bold.b6770918.woff","/_next/static/media/KaTeX_Caligraphic-Bold.cce5b8ec.ttf","/_next/static/media/KaTeX_Caligraphic-Bold.ec17d132.woff2","/_next/static/media/KaTeX_Caligraphic-Regular.07ef19e7.ttf","/_next/static/media/KaTeX_Caligraphic-Regular.55fac258.woff2","/_next/static/media/KaTeX_Caligraphic-Regular.dad44a7f.woff","/_next/static/media/KaTeX_Fraktur-Bold.9f256b85.woff","/_next/static/media/KaTeX_Fraktur-Bold.b18f59e1.ttf","/_next/static/media/KaTeX_Fraktur-Bold.d42a5579.woff2","/_next/static/media/KaTeX_Fraktur-Regular.7c187121.woff","/_next/static/media/KaTeX_Fraktur-Regular.d3c882a6.woff2","/_next/static/media/KaTeX_Fraktur-Regular.ed38e79f.ttf","/_next/static/media/KaTeX_Main-Bold.b74a1a8b.ttf","/_next/static/media/KaTeX_Main-Bold.c3fb5ac2.woff2","/_next/static/media/KaTeX_Main-Bold.d181c465.woff","/_next/static/media/KaTeX_Main-BoldItalic.6f2bb1df.woff2","/_next/static/media/KaTeX_Main-BoldItalic.70d8b0a5.ttf","/_next/static/media/KaTeX_Main-BoldItalic.e3f82f9d.woff","/_next/static/media/KaTeX_Main-Italic.47373d1e.ttf","/_next/static/media/KaTeX_Main-Italic.8916142b.woff2","/_next/static/media/KaTeX_Main-Italic.9024d815.woff","/_next/static/media/KaTeX_Main-Regular.0462f03b.woff2","/_next/static/media/KaTeX_Main-Regular.7f51fe03.woff","/_next/static/media/KaTeX_Main-Regular.b7f8fe9b.ttf","/_next/static/media/KaTeX_Math-BoldItalic.572d331f.woff2","/_next/static/media/KaTeX_Math-BoldItalic.a879cf83.ttf","/_next/static/media/KaTeX_Math-BoldItalic.f1035d8d.woff","/_next/static/media/KaTeX_Math-Italic.5295ba48.woff","/_next/static/media/KaTeX_Math-Italic.939bc644.ttf","/_next/static/media/KaTeX_Math-Italic.f28c23ac.woff2","/_next/static/media/KaTeX_SansSerif-Bold.8c5b5494.woff2","/_next/static/media/KaTeX_SansSerif-Bold.94e1e8dc.ttf","/_next/static/media/KaTeX_SansSerif-Bold.bf59d231.woff","/_next/static/media/KaTeX_SansSerif-Italic.3b1e59b3.woff2","/_next/static/media/KaTeX_SansSerif-Italic.7c9bc82b.woff","/_next/static/media/KaTeX_SansSerif-Italic.b4c20c84.ttf","/_next/static/media/KaTeX_SansSerif-Regular.74048478.woff","/_next/static/media/KaTeX_SansSerif-Regular.ba21ed5f.woff2","/_next/static/media/KaTeX_SansSerif-Regular.d4d7ba48.ttf","/_next/static/media/KaTeX_Script-Regular.03e9641d.woff2","/_next/static/media/KaTeX_Script-Regular.07505710.woff","/_next/static/media/KaTeX_Script-Regular.fe9cbbe1.ttf","/_next/static/media/KaTeX_Size1-Regular.e1e279cb.woff","/_next/static/media/KaTeX_Size1-Regular.eae34984.woff2","/_next/static/media/KaTeX_Size1-Regular.fabc004a.ttf","/_next/static/media/KaTeX_Size2-Regular.57727022.woff","/_next/static/media/KaTeX_Size2-Regular.5916a24f.woff2","/_next/static/media/KaTeX_Size2-Regular.d6b476ec.ttf","/_next/static/media/KaTeX_Size3-Regular.9acaf01c.woff","/_next/static/media/KaTeX_Size3-Regular.a144ef58.ttf","/_next/static/media/KaTeX_Size3-Regular.b4230e7e.woff2","/_next/static/media/KaTeX_Size4-Regular.10d95fd3.woff2","/_next/static/media/KaTeX_Size4-Regular.7a996c9d.woff","/_next/static/media/KaTeX_Size4-Regular.fbccdabe.ttf","/_next/static/media/KaTeX_Typewriter-Regular.6258592b.woff","/_next/static/media/KaTeX_Typewriter-Regular.a8709e36.woff2","/_next/static/media/KaTeX_Typewriter-Regular.d97aaf4a.ttf","/_next/static/media/aeb6494c7cb41e1c.ttf","/_next/static/media/d85d1fd074c69dec.ttf","/_next/static/media/fcf6bd7943ceb169.p.ttf","/_next/static/chunks/app/layout-ff53723956118c37.js","/_next/static/chunks/app/page-17132ace0d0d987a.js","/_next/static/chunks/app/[section]/page-a240c56691959f35.js","/_next/static/chunks/app/_global-error/page-79ce168682fdbc8c.js","/_next/static/chunks/app/_not-found/page-6dc43050004ab4f5.js","/_next/static/chunks/app/verify-email/page-79ce168682fdbc8c.js","/_next/static/chunks/app/api/[...path]/route-79ce168682fdbc8c.js","/_next/static/chunks/next/dist/client/components/builtin/app-error-79ce168682fdbc8c.js","/_next/static/chunks/next/dist/client/components/builtin/forbidden-79ce168682fdbc8c.js","/_next/static/chunks/next/dist/client/components/builtin/global-error-f636d659ec9f79a5.js","/_next/static/chunks/next/dist/client/components/builtin/not-found-79ce168682fdbc8c.js","/_next/static/chunks/next/dist/client/components/builtin/unauthorized-79ce168682fdbc8c.js","/icon.svg","/manifest.webmanifest"];
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

const CACHE = "khshta-v3";
const SHELL = ["./", "./index.html"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isPage(req) {
  if (req.mode === "navigate" || req.destination === "document") return true;
  const p = new URL(req.url).pathname;
  return p.endsWith("/") || p.endsWith("/index.html");
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // The Google Sheet is always live — never served from cache.
  if (req.url.indexOf("docs.google.com") > -1 || req.url.indexOf("googleusercontent.com") > -1) {
    e.respondWith(fetch(req).catch(() => new Response("", { status: 504 })));
    return;
  }

  // The page itself: network first, so a new upload shows up right away.
  if (isPage(req)) {
    e.respondWith(
      fetch(req, { cache: "no-store" })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html", { ignoreSearch: true })
          .then(hit => hit || caches.match("./", { ignoreSearch: true })))
    );
    return;
  }

  // Everything else (fonts and so on): cache first.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});

/* Banff 2026 — consultation hors ligne.
   Garde sur l'appareil une copie de la page (toujours chiffrée), des icônes et des polices.
   En ligne : la page la plus récente est téléchargée (4 s maximum), puis mise en cache.
   Sans réseau, réseau trop lent ou site en erreur : la dernière copie enregistrée est affichée. */
const VERSION = "banff-v1";
const SCOPE = self.registration.scope;
const PAGE = new URL("index.html", SCOPE).href;
const CORE = ["index.html", "favicon.svg", "favicon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"]
  .map((p) => new URL(p, SCOPE).href);
const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:ital,wght@0,400;0,500;0,600;0,700;1,500&display=swap";
const NETWORK_WAIT_MS = 4000;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE.map((u) => new Request(u, { cache: "reload" })));
    try { await cacheFonts(cache); } catch (_) { /* polices facultatives */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // La page elle-même : réseau d'abord, copie locale si pas de réseau ou réseau trop lent.
  if (req.mode === "navigate" && req.url.startsWith(SCOPE)) {
    const net = fetch(req).then(async (res) => {
      if (res.ok) {
        const copy = res.clone();
        const cache = await caches.open(VERSION);
        await cache.put(PAGE, copy);
      }
      return res;
    });
    e.waitUntil(net.catch(() => {}));
    e.respondWith((async () => {
      try {
        const res = await Promise.race([net, wait(NETWORK_WAIT_MS)]);
        if (res.ok) return res;
        return (await caches.match(PAGE)) || res; // site en erreur (404, panne) : copie locale
      } catch (_) {
        return (await caches.match(PAGE)) || net;
      }
    })());
    return;
  }

  // Icônes et polices : copie locale tout de suite, rafraîchie en arrière-plan.
  const isOwn = req.url.startsWith(SCOPE);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!isOwn && !isFont) return;
  const refresh = fetch(req).then(async (res) => {
    if (res.ok || res.type === "opaque") {
      const copy = res.clone();
      const cache = await caches.open(VERSION);
      await cache.put(req, copy);
    }
    return res;
  });
  e.waitUntil(refresh.catch(() => {}));
  e.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit || refresh));
});

function wait(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("réseau trop lent")), ms));
}

async function cacheFonts(cache) {
  const res = await fetch(FONT_CSS);
  if (!res.ok) return;
  await cache.put(FONT_CSS, res.clone());
  const css = await res.text();
  const files = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]);
  await Promise.all(files.map((u) => fetch(u).then((r) => (r.ok ? cache.put(u, r) : null)).catch(() => {})));
}

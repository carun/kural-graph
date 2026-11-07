// Kural Graph service worker — makes the graph, couplets, commentaries and app shell available offline.
// Cache-first for immutable build assets and the knowledge-graph data; network-first for pages.
// scripts/finish-export.mjs fills in VERSION and SHELL from each build, so a first visit keeps everything a view can
// ask for, and any change to those files makes a new worker.
const VERSION = "kural-graph-dev";
const SHELL = ["/"];
// Every commentary in one file, unpacked below. As 1,330 requests, one failure would stop the whole install.
const COMMENTARY = "/data/commentary-all.json";
// The embedding model, kept by src/kural/embedder.worker.ts. It is a large download, so it outlives a new version.
const MODELS = "kural-graph-models";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then(async (c) => {
        // "reload" skips the HTTP cache, which may still hold the last deploy's data.
        await c.addAll(SHELL.map((url) => new Request(url, { cache: "reload" })));
        const all = await (await fetch(COMMENTARY, { cache: "reload" })).json();
        const json = { headers: { "Content-Type": "application/json" } };
        await Promise.all(Object.entries(all).map(([id, doc]) => c.put(`/data/commentary/${id}.json`, new Response(JSON.stringify(doc), json))));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== MODELS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Model calls go to other origins. The embedding worker keeps its own large files, so they are left to it. Recordings
  // are left alone too: players ask for byte ranges, and a cache can't store a partial reply.
  if (e.request.method !== "GET" || url.origin !== self.location.origin || /^\/(models|audio)\//.test(url.pathname) || url.pathname.endsWith(".wasm")) return;
  const cacheFirst = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/data/") || url.pathname.startsWith("/images/");
  if (cacheFirst) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            // Cloned now: by the time the cache opens, the page may have started reading the body.
            const copy = res.clone();
            if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, copy));
            return res;
          }),
      ),
    );
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        if (res.ok && e.request.mode === "navigate") caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      // Only a page may fall back to the app. Anything else would be handed HTML with a 200 and could keep it.
      .catch(() => caches.match(e.request).then((hit) => hit || (e.request.mode === "navigate" ? caches.match("/") : Response.error()))),
  );
});

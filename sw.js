// ===== Collage Canvas — Advanced Service Worker =====

const STATIC_CACHE   = "cc-static-v1";
const RUNTIME_CACHE  = "cc-runtime-v1";
const IMAGE_CACHE    = "cc-images-v1";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./library.html",

  "./js/main.js",
  "./js/library.js",
  "./js/binder.js",
  "./js/auth.js",
  "./js/appwrite-client.js",

  "./style/style_main.css",
  "./style/style_library.css",

  "./media/flippage.mp3",
];

function log(...args) {
  console.log("[SW]", ...args);
}

// ===== INSTALL =====
self.addEventListener("install", (event) => {
  log("install");
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      log("precache", PRECACHE_URLS);
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// ===== ACTIVATE =====
self.addEventListener("activate", (event) => {
  log("activate");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key !== STATIC_CACHE &&
              key !== RUNTIME_CACHE &&
              key !== IMAGE_CACHE
          )
          .map((key) => {
            log("delete old cache", key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirstForPage(request));
    return;
  }

  if (isSameOrigin(url)) {
    if (url.pathname.includes("/api/")) {
      event.respondWith(networkFirstAPI(request));
      return;
    }

    if (
      url.pathname.includes("/media/") ||
      url.pathname.includes("/collageoutput/")
    ) {
      event.respondWith(staleWhileRevalidateImages(request));
      return;
    }

    if (
      url.pathname.includes("/js/") ||
      url.pathname.includes("/style/")
    ) {
      event.respondWith(cacheFirstStatic(request));
      return;
    }
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

async function networkFirstForPage(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match("./index.html");
  }
}

async function networkFirstAPI(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(STATIC_CACHE);
  cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidateImages(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    networkFetch;
    return cached;
  }

  const net = await networkFetch;
  if (net) return net;

  return new Response("", { status: 404 });
}

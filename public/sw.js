// Service worker: network-first for HTML navigations (so new deploys are
// picked up immediately), cache-first for hashed static assets (JS/CSS/images
// are safe to cache indefinitely because their filenames change on content
// change). Non-GET and cross-origin requests bypass.
const CACHE = 'personal-manager-v2'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['/', '/manifest.json']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // HTML navigations: network-first so new deploys load without a hard refresh.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          const cache = await caches.open(CACHE)
          cache.put(request, response.clone())
          return response
        } catch {
          const cached = await caches.match(request)
          return cached ?? caches.match('/') ?? Response.error()
        }
      })(),
    )
    return
  }

  // Static assets (JS, CSS, images): cache-first. These are content-hashed so
  // a stale cache entry always matches the HTML that references it.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      try {
        const response = await fetch(request)
        const copy = response.clone()
        const cache = await caches.open(CACHE)
        cache.put(request, copy)
        return response
      } catch {
        return cached ?? Response.error()
      }
    })(),
  )
})

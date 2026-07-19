// Minimal service worker: caches the app shell for installability and basic
// offline support. Cache-first for same-origin GETs; falls back to network and
// stashes a copy for next time. Non-GET and cross-origin requests bypass.
const CACHE = 'personal-manager-v1'

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

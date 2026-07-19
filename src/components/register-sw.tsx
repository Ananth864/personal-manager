import { useEffect } from 'react'

/**
 * Registers the service worker so the app is installable and can serve a
 * cached shell offline. Runs client-side only (useEffect is a no-op on the
 * server). Rendered once from the root document.
 */
export function RegisterSw() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      import.meta.env.PROD
    ) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failure is non-fatal — the app still works online.
      })
    }
  }, [])

  return null
}

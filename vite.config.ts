import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'

const config = defineConfig(({ command, mode }) => {
  // Vite only auto-exposes VITE_-prefixed vars. Clerk's backend (clerkMiddleware,
  // auth()) reads CLERK_SECRET_KEY from process.env, so load every .env var and
  // surface the non-prefixed (server-only) ones into process.env for the dev server.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('VITE_') && process.env[key] === undefined) {
      process.env[key] = value
    }
  }

  return {
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      // The Netlify adapter is only needed for the production build. Loading it in
      // dev spins up @netlify/dev, which has a CJS interop issue under Bun
      // (`omit.default is not a function`). TanStack Start's own dev handler
      // covers server functions locally; Clerk's clerkMiddleware runs via that.
      ...(command === 'build' ? [netlify()] : []),
    ],
  }
})

export default config

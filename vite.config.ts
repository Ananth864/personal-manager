import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'

const config = defineConfig(({ command }) => ({
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
}))

export default config

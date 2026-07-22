import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      // zod v4's ESM entry re-exports its namespace (`import * as z; export { z}`),
      // which vitest's SSR transform breaks (`z` resolves to undefined). The CJS
      // build exposes `z` as a property and interops cleanly, so alias to it.
      zod: fileURLToPath(new URL('./node_modules/zod/index.cjs', import.meta.url)),
    },
  },
})

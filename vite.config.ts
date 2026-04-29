import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // `npm run dev` proxies `/api/*` to `npm run api:dev` (default :3333). Override with
  // `DEV_API_PROXY` in `.env.local` (legacy: `vercel dev` on :3000).
  const devApiProxy =
    process.env.DEV_API_PROXY ?? env.DEV_API_PROXY ?? 'http://127.0.0.1:3333'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: devApiProxy, changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}', 'handlers/**/*.test.ts'],
    },
  }
})

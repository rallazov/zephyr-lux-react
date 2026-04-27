import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// `npm run dev` (Vite) proxies `/api/*` to `vercel dev` (default :3000) so OrderConfirmation
// can `fetch("/api/...")`. Override with `DEV_API_PROXY` (e.g. `http://127.0.0.1:3000`).
const devApiProxy = process.env.DEV_API_PROXY ?? 'http://127.0.0.1:3000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: devApiProxy, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'api/**/*.test.ts'],
  },
})

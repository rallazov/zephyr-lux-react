# Zephyr Lux (React + TypeScript + Vite)

E-commerce front end with Vite, React Router, Stripe checkout, and a **Node HTTP API** (`handlers/` + `server/`) suited for Railway or any host; **Vercel Hobby** deploys the **static SPA** only (no `/api` folder — avoids the 12 serverless-function cap).

## Configuration

**Environment variables:** See the committed [`.env.example`](.env.example) for every name the app reads today (client `VITE_*` vs server-only), required vs optional defaults, and where each is used. Copy into `.env.local` for local development.

| Context | What to use |
|--------|-------------|
| **Local** | `npm run dev:full` — Vite on `5173` proxies `/api` to `npm run api:dev` (default **:3333**). Set server env in `.env.local` for the API process; `FRONTEND_URL=http://localhost:5173`. |
| **Railway** | Deploy from this repo; start command uses `npm start` (`tsx server/index.ts`). Optional [`railway.toml`](railway.toml) sets `/health` for deploy checks. Set all server secrets from `.env.example` (see `handlers/_lib/env.ts`). `FRONTEND_URL` = your live Vercel storefront URL. Stripe webhook: `https://<railway-host>/api/stripe-webhook`. |
| **Vercel (storefront)** | Build the Vite app. Set **`VITE_PUBLIC_API_URL`** to your Railway API origin (no trailing slash) so the browser calls the API cross-origin. **No** server secrets on Vercel. |
| **Vercel Preview** | Same as production for split: preview URL in `FRONTEND_URL` on Railway (or use prod API — your choice). |

Payment-focused setup (Stripe CLI, webhook forwarding) is in [README-payments.md](README-payments.md).

---

This project started from the Vite React + TS template. Below is the original Vite README for ESLint and tooling reference.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```

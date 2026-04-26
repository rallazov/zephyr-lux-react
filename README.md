# Zephyr Lux (React + TypeScript + Vite)

E-commerce front end with Vite, React Router, Stripe checkout, and Vercel serverless API routes.

## Configuration

**Environment variables:** See the committed [`.env.example`](.env.example) for every name the app reads today (client `VITE_*` vs server-only), required vs optional defaults, and where each is used. Copy into `.env.local` for local development and mirror names in the Vercel project for preview/production.

| Context | What to use |
|--------|-------------|
| **Local** | Vite on port `5173` and `vercel dev` for API routes (see `npm run dev:full`). Use **Stripe test** keys (`pk_test_` / `sk_test_`); point `FRONTEND_URL` at `http://localhost:5173`. |
| **Vercel Preview** | **Test** Stripe keys; set `FRONTEND_URL` to the preview URL (`https://…vercel.app`). Webhook secret must match the preview webhook endpoint. |
| **Vercel Production** | **Live** Stripe keys only; `FRONTEND_URL` must be your real customer-facing domain. Configure a **production** Stripe webhook and signing secret. |

**`VITE_API_URL` (subscription / newsletter):** [SubscriptionForm](src/components/SubscriptionForm/SubscriptionForm.tsx) uses `VITE_API_URL` and falls back to `http://localhost:5000` in code when unset. For **`npm run dev:full`** (Vite + `vercel dev`), set `VITE_API_URL` in `.env.local` to the **API origin printed by `vercel dev`** in your terminal—commonly `http://localhost:3000` unless you change the listen port. Do not assume the code default matches `vercel dev` unless you run the API on port 5000.

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

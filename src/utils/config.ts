// config.ts (or your config file)
export const IS_MOCK_PAYMENT: boolean = (import.meta as any).env?.VITE_USE_MOCK_STRIPE === "true";

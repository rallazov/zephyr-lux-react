import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

/** Vitest + jsdom can expose a broken `localStorage` in some configs; CartContext requires a full Storage. */
const memoryStore: Record<string, string> = {};
const memoryStorage: Storage = {
  get length() {
    return Object.keys(memoryStore).length;
  },
  clear() {
    for (const k of Object.keys(memoryStore)) delete memoryStore[k];
  },
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(memoryStore, key)
      ? memoryStore[key]
      : null;
  },
  key(index) {
    const keys = Object.keys(memoryStore);
    return keys[index] ?? null;
  },
  removeItem(key) {
    delete memoryStore[key];
  },
  setItem(key, value) {
    memoryStore[key] = value;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: memoryStorage,
  configurable: true,
  writable: true,
});

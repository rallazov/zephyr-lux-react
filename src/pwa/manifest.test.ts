import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const _dir = dirname(fileURLToPath(import.meta.url));

function manifestPath(): string {
  return join(_dir, "../../public/manifest.webmanifest");
}

describe("manifest.webmanifest", () => {
  it("parses as JSON Web App Manifest with admin start_url and standalone display", () => {
    const raw = readFileSync(manifestPath(), "utf8");
    const m = JSON.parse(raw) as Record<string, unknown>;

    expect(m.name).toBe("Zephyr Lux Admin");
    expect(m.short_name).toBe("ZL Admin");
    expect(m.display).toBe("standalone");
    expect(m.scope).toBe("/admin/");
    expect(m.start_url).toBe("/admin/orders");
    expect(typeof m.theme_color === "string" && String(m.theme_color).length >= 4).toBe(
      true,
    );
    expect(typeof m.background_color === "string").toBe(true);

    const icons = m.icons as { src?: string }[] | undefined;
    expect(Array.isArray(icons) && icons.length >= 1).toBe(true);
    for (const icon of icons ?? []) {
      expect(String(icon.src ?? "")).not.toContain("MISSING_PLACEHOLDER");
      expect(icon.src ?? "").toMatch(/^\/pwa-icon-\d+\.png$/);
    }
  });
});

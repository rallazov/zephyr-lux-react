/** Returns normalized http(s) href or null (no `javascript:` / opaque URL injection). */
export function safeHttpUrlForHref(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

/** True when `raw` parses as an absolute http(s) URL suitable for navigation. */
export function isSafeHttpUrl(raw: string): boolean {
  return safeHttpUrlForHref(raw) !== null;
}

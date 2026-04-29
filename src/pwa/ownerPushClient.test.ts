import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array } from "./ownerPushClient";

describe("ownerPushClient", () => {
  it("urlBase64ToUint8Array decodes url-safe base64", () => {
    const input = btoa("hello").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const out = urlBase64ToUint8Array(input);
    expect(Array.from(out)).toEqual([104, 101, 108, 108, 111]);
  });
});

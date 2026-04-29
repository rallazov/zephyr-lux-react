// @vitest-environment node
import { describe, expect, it } from "vitest";
import { detectImageMimeFromMagicBytes } from "./shipmentImageBytes";

describe("detectImageMimeFromMagicBytes", () => {
  it("detects JPEG", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(detectImageMimeFromMagicBytes(buf)).toEqual({
      mime: "image/jpeg",
      ext: "jpg",
    });
  });

  it("detects PNG", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(detectImageMimeFromMagicBytes(buf)).toEqual({
      mime: "image/png",
      ext: "png",
    });
  });

  it("detects WebP", () => {
    const buf = Buffer.alloc(16);
    buf.write("RIFF", 0);
    buf.write("WEBP", 8);
    expect(detectImageMimeFromMagicBytes(buf)).toEqual({
      mime: "image/webp",
      ext: "webp",
    });
  });

  it("returns null for unknown", () => {
    expect(detectImageMimeFromMagicBytes(Buffer.from([0x00, 0x01]))).toBeNull();
  });
});

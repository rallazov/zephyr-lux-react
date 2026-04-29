import type { ShipmentImageMime } from "../../src/domain/commerce/shipmentImage";

export type DetectedImage = {
  mime: ShipmentImageMime;
  ext: "jpg" | "png" | "webp";
};

/** Inspect leading bytes; do not trust Content-Type or filename. */
export function detectImageMimeFromMagicBytes (buf: Buffer): DetectedImage | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    buf.length >= 8
    && buf[0] === 0x89
    && buf[1] === 0x50
    && buf[2] === 0x4e
    && buf[3] === 0x47
    && buf[4] === 0x0d
    && buf[5] === 0x0a
    && buf[6] === 0x1a
    && buf[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    buf.length >= 12
    && buf.toString("ascii", 0, 4) === "RIFF"
    && buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

/**
 * What may be uploaded, shared by the browser and the token route.
 *
 * Both ends have to agree, and only one of them can be trusted: the client
 * checks so a phone does not spend a minute uploading something that will be
 * refused, and the server checks because the client's check is a courtesy.
 *
 * Pure and dependency-free so `handleUpload` and a form control can both import
 * it without pulling `@vercel/blob` into the bundle.
 */

/** Image formats a poster or a ticket logo may be. */
export const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
] as const;

/**
 * SVG is deliberately absent.
 *
 * It was allowed while these were data URLs rendered into an `<img>`, which is
 * inert. A blob URL is a *file on a domain*, and an SVG is a document that can
 * carry `<script>` — served from a Vercel Blob host, that is someone else's
 * origin, but it is still a file the product invited a stranger to upload and
 * then handed to other people's browsers. Rasterise before uploading.
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** The things a user can attach, kept apart so limits can differ. */
export type UploadKind = "poster" | "ticket-art" | "workspace";

export const UPLOAD_PREFIX: Record<UploadKind, string> = {
  poster: "posters",
  "ticket-art": "ticket-art",
  // Logo and banner share a folder: both are workspace artwork with the same
  // limits, and splitting them would buy nothing but two constants.
  workspace: "workspaces",
};

export function isUploadKind(value: unknown): value is UploadKind {
  // `Object.hasOwn`, not `in`: `"constructor" in UPLOAD_PREFIX` is true.
  return typeof value === "string" && Object.hasOwn(UPLOAD_PREFIX, value);
}

/**
 * The longest edge each kind is stored at, in CSS pixels.
 *
 * A phone camera produces 4000px images and every one of them was being stored
 * and served at full size. These are sized from where the image is actually
 * rendered, doubled for a retina screen:
 *
 * - a **poster** is a 16:9 cover filling a phone's width, and is also the
 *   largest thing on the public event page;
 * - **ticket art** is a logo on a ticket, which is additionally rasterised to
 *   PNG by `html-to-image` when the holder exports it;
 * - a **workspace** logo never renders above 64px, and its banner above ~400.
 */
export const MAX_DIMENSION: Record<UploadKind, number> = {
  poster: 1600,
  "ticket-art": 1024,
  workspace: 1024,
};

/**
 * Above this, an image is re-encoded even if its dimensions already fit.
 *
 * A 300×300 PNG can still be 3MB; dimensions alone are not a proxy for bytes.
 */
export const DOWNSCALE_ABOVE_BYTES = 512 * 1024;

/**
 * Fit `w`×`h` inside a `max`×`max` box, preserving the aspect ratio.
 *
 * Returns the input unchanged when it already fits — callers use that to skip
 * the re-encode entirely rather than round-trip an image through a canvas for
 * nothing. Never returns a zero edge: a 2000×3 banner would otherwise scale to
 * a height of 0 and produce a blank image instead of a thin one.
 */
export function fitWithin(
  w: number,
  h: number,
  max: number,
): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const scale = max / Math.max(w, h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/** Human-readable refusal for an unacceptable *format*, or `undefined`. */
export function rejectImageType(type: string): string | undefined {
  if (!IMAGE_TYPES.includes(type as (typeof IMAGE_TYPES)[number])) {
    return "فقط تصویر PNG، JPEG، WebP یا AVIF پذیرفته می‌شود.";
  }
  return undefined;
}

/** Human-readable refusal for an oversized file, or `undefined`. */
export function rejectImageSize(size: number): string | undefined {
  if (size > MAX_IMAGE_BYTES) {
    return "حجم تصویر باید کمتر از ۴ مگابایت باشد.";
  }
  return undefined;
}

/**
 * Both checks at once.
 *
 * Kept for the server's benefit, which sees one finished file. The client runs
 * them at *different moments* — format before decoding, size after downscaling
 * — because refusing a 9MB phone photo that would have become 200KB is a worse
 * product than resizing it.
 */
export function rejectImage(file: {
  type: string;
  size: number;
}): string | undefined {
  const badType = rejectImageType(file.type);
  if (badType) return badType;
  const tooBig = rejectImageSize(file.size);
  if (tooBig) return tooBig;
  return undefined;
}

/**
 * Is this a URL we put in the database ourselves?
 *
 * Stored image fields used to be data URLs, which are self-describing — the
 * bytes are right there. A blob URL is a *reference*, so a field that accepts
 * one accepts a pointer at any host on the internet unless it is checked, and
 * that pointer is then rendered in other people's browsers and printed on
 * tickets.
 *
 * Vercel Blob serves everything from `*.public.blob.vercel-storage.com`, so
 * that is the whole allowlist. Data URLs stay valid because rows written before
 * this still hold them.
 */
export function isStoredImage(value: string): boolean {
  if (value.startsWith("data:image/")) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

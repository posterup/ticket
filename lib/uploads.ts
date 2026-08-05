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

/** Human-readable refusal, or `undefined` when the file is acceptable. */
export function rejectImage(file: {
  type: string;
  size: number;
}): string | undefined {
  if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number])) {
    return "فقط تصویر PNG، JPEG، WebP یا AVIF پذیرفته می‌شود.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "حجم تصویر باید کمتر از ۴ مگابایت باشد.";
  }
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

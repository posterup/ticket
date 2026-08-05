"use client";

import { upload } from "@vercel/blob/client";

import {
  DOWNSCALE_ABOVE_BYTES,
  MAX_DIMENSION,
  fitWithin,
  rejectImageSize,
  rejectImageType,
  type UploadKind,
} from "@/lib/uploads";

/**
 * Shrink an image to the longest edge its kind is served at, as WebP.
 *
 * A phone camera hands over a 4000px, 6MB JPEG for something that renders 300px
 * wide, and all of those bytes were being stored, billed, and pushed down a
 * mobile connection twice — once up, and once to every visitor afterwards.
 *
 * **WebP, not JPEG**, because it keeps the alpha channel: a logo with a
 * transparent background is exactly the case that would otherwise come back
 * with a black box behind it.
 *
 * **Returns the original on any failure.** `createImageBitmap`, `toBlob` and
 * the codec are all things a browser may not have or may refuse (a corrupt
 * file, a memory limit on a large image). An upload that works is worth more
 * than an upload that is small, so every unhappy path falls through to the file
 * the reader picked. The size ceiling is still enforced after this returns.
 */
async function downscale(file: File, kind: UploadKind): Promise<File> {
  const max = MAX_DIMENSION[kind];
  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
    // Already small in both senses: re-encoding would spend time and quality to
    // make a crisp 40KB logo into a lossy 40KB logo.
    const fits = width === bitmap.width && height === bitmap.height;
    if (fits && file.size <= DOWNSCALE_ABOVE_BYTES) return file;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    // A browser without the WebP encoder returns null rather than throwing.
    if (!blob) return file;
    // And one that quietly fell back to PNG would hand back something larger
    // than it was given, which is the opposite of the point.
    if (blob.size >= file.size && fits) return file;

    // The name carries the extension Blob infers a content type from, so it has
    // to follow the bytes rather than the file the reader chose.
    const name = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${name}.webp`, { type: "image/webp" });
  } catch (error) {
    console.error("[upload] downscale failed, sending the original", error);
    return file;
  } finally {
    bitmap.close();
  }
}

/**
 * Put one image in Blob and get back the URL to store.
 *
 * Replaces `FileReader.readAsDataURL`, which is what every image path used
 * before: the bytes were base64'd into the record itself, so a 400KB poster
 * became ~540KB of JSON that was read, parsed and re-serialised on every single
 * fetch of the event — and travelled in the SSR payload of the public page.
 * Storing a URL makes the row small again and lets a CDN serve the image.
 *
 * The browser talks to Blob directly; `/api/uploads` only signs the request.
 * Nothing here is trusted — the same limits are enforced on the token — but
 * checking first means a phone on a slow connection is told immediately rather
 * than after uploading four megabytes.
 *
 * The two checks run at different moments on purpose. **Format** is refused up
 * front, before any decoding. **Size** is checked on what is actually about to
 * be sent, after the downscale — a 9MB photo that becomes 200KB is a photo the
 * product should accept, and refusing it because of what it weighed on the
 * camera roll would be the wrong answer to the right question.
 *
 * Throws with a Persian message, so callers can surface `error.message` as-is.
 */
export async function uploadImage(
  file: File,
  kind: UploadKind,
): Promise<string> {
  const badType = rejectImageType(file.type);
  if (badType) throw new Error(badType);

  const resized = await downscale(file, kind);

  const tooBig = rejectImageSize(resized.size);
  if (tooBig) throw new Error(tooBig);

  try {
    const blob = await upload(resized.name, resized, {
      access: "public",
      handleUploadUrl: "/api/uploads",
      // Read back in `onBeforeGenerateToken`; it picks the folder and is the
      // only thing the client gets to say about where the file lands.
      clientPayload: JSON.stringify({ kind }),
    });
    return blob.url;
  } catch (error) {
    /**
     * Blob's errors are English and often mention its internals, which is not
     * what an organiser should read. The real cause is in the console for us
     * and a sentence they can act on is on screen for them.
     */
    console.error("[upload] failed", error);
    throw new Error("بارگذاری تصویر ناموفق بود. دوباره تلاش کنید.");
  }
}

"use client";

import { upload } from "@vercel/blob/client";

import { rejectImage, type UploadKind } from "@/lib/uploads";

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
 * Throws with a Persian message, so callers can surface `error.message` as-is.
 */
export async function uploadImage(
  file: File,
  kind: UploadKind,
): Promise<string> {
  const refusal = rejectImage(file);
  if (refusal) throw new Error(refusal);

  try {
    const blob = await upload(file.name, file, {
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

/**
 * What may be uploaded, and what may be *stored* as an image.
 *
 * The second is the one with teeth. While images were data URLs the bytes were
 * in the record and self-describing; a Blob URL is a **reference**, so a field
 * that takes one takes a pointer at any host on the internet unless it is
 * checked — and that pointer is then rendered in other people's browsers and
 * printed onto tickets.
 */

import { describe, it, expect } from "vitest";

import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  isStoredImage,
  isUploadKind,
  rejectImage,
} from "@/lib/uploads";

const BLOB = "https://abc123.public.blob.vercel-storage.com/posters/1-x9.jpg";

describe("isStoredImage", () => {
  it("accepts our own Blob host", () => {
    expect(isStoredImage(BLOB)).toBe(true);
  });

  it("still accepts the data URLs already in the database", () => {
    // Rows written before uploads moved to Blob hold these; refusing them would
    // make every existing ticket design unsaveable.
    expect(isStoredImage("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
  });

  it("refuses a pointer at somebody else's host", () => {
    for (const url of [
      "https://evil.example.com/tracker.png",
      "https://public.blob.vercel-storage.com.evil.com/x.png",
      "https://notblob.vercel-storage.com/x.png",
    ]) {
      expect(isStoredImage(url)).toBe(false);
    }
  });

  it("refuses a lookalike that only ends the right way as a path", () => {
    // `endsWith` on the *hostname*, not on the whole URL — otherwise
    // `https://evil.com/?x=.public.blob.vercel-storage.com` would pass.
    expect(
      isStoredImage("https://evil.com/?x=.public.blob.vercel-storage.com"),
    ).toBe(false);
  });

  it("refuses plaintext, and schemes that are not http at all", () => {
    expect(isStoredImage("http://abc.public.blob.vercel-storage.com/x.png")).toBe(false);
    expect(isStoredImage("javascript:alert(1)")).toBe(false);
    expect(isStoredImage("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
  });

  it("refuses junk rather than throwing on it", () => {
    for (const value of ["", "not a url", "//example.com/x.png"]) {
      expect(isStoredImage(value)).toBe(false);
    }
  });
});

describe("rejectImage", () => {
  it("passes the formats a browser can actually decode", () => {
    for (const type of IMAGE_TYPES) {
      expect(rejectImage({ type, size: 1024 })).toBeUndefined();
    }
  });

  it("refuses SVG, which is a document and not a picture", () => {
    // Allowed while these were inert data URLs. A blob URL is a *file served
    // from a host*, and an SVG can carry script.
    expect(rejectImage({ type: "image/svg+xml", size: 1024 })).toBeTruthy();
  });

  it("refuses anything that is not an image", () => {
    expect(rejectImage({ type: "application/pdf", size: 1024 })).toBeTruthy();
    expect(rejectImage({ type: "video/mp4", size: 1024 })).toBeTruthy();
  });

  it("holds the size ceiling exactly", () => {
    expect(rejectImage({ type: "image/png", size: MAX_IMAGE_BYTES })).toBeUndefined();
    expect(rejectImage({ type: "image/png", size: MAX_IMAGE_BYTES + 1 })).toBeTruthy();
  });

  it("answers in Persian, because the answer is shown to a person", () => {
    expect(rejectImage({ type: "application/pdf", size: 1 })).toMatch(/[؀-ۿ]/);
  });
});

describe("isUploadKind", () => {
  it("accepts only the two folders the token route knows", () => {
    expect(isUploadKind("poster")).toBe(true);
    expect(isUploadKind("ticket-art")).toBe(true);
  });

  it("refuses anything else, including a path traversal attempt", () => {
    // The kind picks the prefix, so an unchecked value writes wherever it likes.
    for (const bad of ["../../etc", "", null, undefined, 1, {}]) {
      expect(isUploadKind(bad)).toBe(false);
    }
  });
});

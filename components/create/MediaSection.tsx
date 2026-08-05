"use client";

import { useState } from "react";
import { uploadImage } from "@/lib/client/upload";
import { ImagePlus, Film, X, Plus } from "lucide-react";

import type { MediaItem } from "@/lib/create/types";

const MAX_IMAGE = 2 * 1024 * 1024; // 2MB
const MAX_VIDEO = 8 * 1024 * 1024; // 8MB

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Poster (single cover image) + a gallery of images/videos for the event. */
export function MediaSection({
  poster,
  gallery,
  onPosterChange,
  onGalleryChange,
}: {
  poster: string | null;
  gallery: MediaItem[];
  onPosterChange: (url: string | null) => void;
  onGalleryChange: (items: MediaItem[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handlePoster(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      // The poster is the one image a stranger sees first, and it used to be
      // base64 in the draft — which never reached the server at all.
      onPosterChange(await uploadImage(file, "poster"));
    } catch (error) {
      setError(error instanceof Error ? error.message : "بارگذاری ناموفق بود.");
    } finally {
      setUploading(false);
    }
  }

  async function handleGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const added: MediaItem[] = [];
    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) {
        setError("فقط تصویر یا ویدیو مجاز است.");
        continue;
      }
      if (file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) {
        setError(isVideo ? "حجم ویدیو باید کمتر از ۸ مگابایت باشد." : "حجم تصویر باید کمتر از ۲ مگابایت باشد.");
        continue;
      }
      added.push({
        id: crypto.randomUUID(),
        type: isVideo ? "video" : "image",
        url: await readAsDataUrl(file),
        name: file.name,
      });
    }
    if (added.length > 0) {
      setError(null);
      onGalleryChange([...gallery, ...added]);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Poster */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">پوستر</span>
        {poster ? (
          <div className="relative w-full max-w-sm overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster} alt="پوستر رویداد" className="aspect-video w-full object-cover" />
            <button
              type="button"
              onClick={() => onPosterChange(null)}
              aria-label="حذف پوستر"
              className="absolute end-2 top-2 grid size-8 place-items-center rounded-md bg-background/80 text-foreground backdrop-blur transition-colors hover:text-danger-text"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <label className="flex aspect-video w-full max-w-sm cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted transition-colors hover:border-border-strong hover:text-foreground">
            <ImagePlus className="size-6" aria-hidden />
            <span className="text-sm font-medium">
              {uploading ? "در حال بارگذاری…" : "بارگذاری پوستر"}
            </span>
            <span className="text-xs text-faint">
              تصویر افقی — به‌طور خودکار کوچک می‌شود
            </span>
            <input type="file" accept="image/*" className="sr-only" onChange={handlePoster} />
          </label>
        )}
      </div>

      {/* Gallery */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">گالری تصاویر و ویدیو</span>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {gallery.map((m) => (
            <div key={m.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
              {m.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.name} className="size-full object-cover" />
              ) : (
                <>
                  <video src={m.url} className="size-full object-cover" muted playsInline />
                  <span className="absolute inset-0 grid place-items-center bg-foreground/50 text-white">
                    <Film className="size-6" aria-hidden />
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={() => onGalleryChange(gallery.filter((g) => g.id !== m.id))}
                aria-label="حذف رسانه"
                className="absolute end-1.5 top-1.5 grid size-7 place-items-center rounded-md bg-background/80 text-foreground backdrop-blur transition-colors hover:text-danger-text"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-muted transition-colors hover:border-border-strong hover:text-foreground">
            <Plus className="size-5" aria-hidden />
            <span className="text-xs font-medium">افزودن</span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="sr-only"
              onChange={handleGallery}
            />
          </label>
        </div>
      </div>

      {error ? <p className="text-sm text-danger-text">{error}</p> : null}
    </div>
  );
}

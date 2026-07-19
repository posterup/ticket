"use client";

import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { isFollowed, setFollowed } from "@/lib/follow";

/** Compact follow toggle for directory cards; persists to localStorage. */
export function FollowChip({ slug, name }: { slug: string; name: string }) {
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    setFollowing(isFollowed(slug));
  }, [slug]);

  function toggle() {
    const next = !following;
    setFollowing(next);
    setFollowed(slug, next);
  }

  return (
    <button
      type="button"
      aria-pressed={following}
      aria-label={`دنبال کردن ${name}`}
      onClick={toggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        following
          ? "border border-border bg-card text-foreground hover:bg-subtle"
          : "bg-foreground text-background hover:opacity-90",
      )}
    >
      {following ? (
        <>
          <Check className="size-3.5" aria-hidden />
          دنبال می‌کنید
        </>
      ) : (
        <>
          <Plus className="size-3.5" aria-hidden />
          دنبال کردن
        </>
      )}
    </button>
  );
}

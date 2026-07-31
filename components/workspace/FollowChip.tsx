"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { setFollowed } from "@/lib/follow";

/**
 * Compact follow toggle for directory cards.
 *
 * `initialFollowing` is resolved on the server by the page that renders this,
 * so there is no flash of the wrong label before an effect corrects it.
 */
export function FollowChip({
  slug,
  name,
  initialFollowing = false,
  signedIn = true,
}: {
  slug: string;
  name: string;
  initialFollowing?: boolean;
  signedIn?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [following, setFollowing] = useState(initialFollowing);

  async function toggle() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const next = !following;
    // Optimistic: the button responds now and reverts if the write fails.
    setFollowing(next);
    if ((await setFollowed(slug, next)) === null) setFollowing(!next);
  }

  return (
    <button
      type="button"
      aria-pressed={following}
      aria-label={`دنبال کردن ${name}`}
      onClick={() => void toggle()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
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

"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setFollowed } from "@/lib/follow";

/**
 * Follow button on a workspace page.
 *
 * `initialFollowing` comes from the server, so the button is correct on first
 * paint rather than after an effect.
 */
export function WorkspaceFollow({
  slug,
  initialFollowing = false,
  signedIn = true,
}: {
  slug: string;
  initialFollowing?: boolean;
  signedIn?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [hover, setHover] = useState(false);

  async function toggle() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const next = !isFollowing;
    // Optimistic, reverting if the write fails.
    setIsFollowing(next);
    if ((await setFollowed(slug, next)) === null) setIsFollowing(!next);
  }

  return (
    <Button
      type="button"
      variant={isFollowing ? "secondary" : "primary"}
      onClick={() => void toggle()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="w-full"
    >
      {isFollowing ? (
        hover ? (
          <>
            <X aria-hidden />
            لغو دنبال کردن
          </>
        ) : (
          <>
            <Check aria-hidden />
            دنبال می‌کنید
          </>
        )
      ) : (
        <>
          <Plus aria-hidden />
          دنبال کردن
        </>
      )}
    </Button>
  );
}

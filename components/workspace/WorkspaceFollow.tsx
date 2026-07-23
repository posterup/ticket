"use client";

import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isFollowed, setFollowed } from "@/lib/follow";

/** Follow button for a workspace, persisted client-side. */
export function WorkspaceFollow({ slug }: { slug: string }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    setIsFollowing(isFollowed(slug));
  }, [slug]);

  function toggle() {
    const next = !isFollowing;
    setIsFollowing(next);
    setFollowed(slug, next);
  }

  return (
    <Button
      type="button"
      variant={isFollowing ? "secondary" : "primary"}
      onClick={toggle}
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

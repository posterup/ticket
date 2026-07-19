"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

/** Follow button with an optimistic follower count and the following count. */
export function WorkspaceFollow({
  followers,
  following,
}: {
  followers: number;
  following: number;
}) {
  const [isFollowing, setIsFollowing] = useState(false);
  const followerCount = followers + (isFollowing ? 1 : 0);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Button
        type="button"
        variant={isFollowing ? "secondary" : "primary"}
        onClick={() => setIsFollowing((v) => !v)}
      >
        {isFollowing ? (
          <>
            <Check aria-hidden />
            دنبال می‌کنید
          </>
        ) : (
          <>
            <Plus aria-hidden />
            دنبال کردن
          </>
        )}
      </Button>

      <div className="flex items-center gap-6 text-sm">
        <span>
          <span className="font-semibold text-foreground">
            {formatNumber(followerCount)}
          </span>{" "}
          <span className="text-muted">دنبال‌کننده</span>
        </span>
        <span>
          <span className="font-semibold text-foreground">
            {formatNumber(following)}
          </span>{" "}
          <span className="text-muted">دنبال‌شده</span>
        </span>
      </div>
    </div>
  );
}

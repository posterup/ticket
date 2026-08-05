import { Building2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A workspace's picture.
 *
 * There is deliberately **no initials fallback**. `Workspace.avatar` holds an
 * uploaded image or nothing; a workspace with no image gets the same neutral
 * icon everywhere rather than a letter derived from its name — which produced
 * things like «سس» for a two-word Persian name and read as a bug, not a logo.
 *
 * Sizing and corner radius come from `className`, because the same picture
 * appears as a 24px chip and a 56px profile tile.
 */
export function WorkspaceAvatar({
  src,
  className,
}: {
  src?: string;
  className?: string;
}) {
  if (src) {
    return (
      // Not `next/image`: the source is a Blob URL on a host that is only
      // known at runtime, so there is nothing to configure a loader against.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn("shrink-0 object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center bg-subtle text-muted",
        className,
      )}
    >
      <Building2 className="size-1/2" />
    </span>
  );
}

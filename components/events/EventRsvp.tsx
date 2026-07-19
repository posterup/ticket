"use client";

import { useEffect, useState } from "react";
import { Star, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { getRsvp, setRsvp, type RsvpState } from "@/lib/rsvp";

/**
 * Interested / Going toggle — the lightweight social commitment for an event,
 * distinct from buying a ticket. Selecting one clears the other; clicking the
 * active choice clears it. Persisted client-side via {@link setRsvp}.
 */
export function EventRsvp({ eventId }: { eventId: string }) {
  const [state, setState] = useState<RsvpState | null>(null);

  useEffect(() => {
    setState(getRsvp(eventId));
  }, [eventId]);

  function choose(next: RsvpState) {
    const value = state === next ? null : next;
    setState(value);
    setRsvp(eventId, value);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => choose("going")}
        aria-pressed={state === "going"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
          state === "going"
            ? "border-foreground bg-foreground text-background"
            : "border-border text-foreground hover:border-border-strong",
        )}
      >
        <Check className="size-4" aria-hidden />
        می‌روم
      </button>
      <button
        type="button"
        onClick={() => choose("interested")}
        aria-pressed={state === "interested"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
          state === "interested"
            ? "border-foreground bg-subtle text-foreground"
            : "border-border text-muted hover:border-border-strong hover:text-foreground",
        )}
      >
        <Star
          className={cn("size-4", state === "interested" && "fill-current")}
          aria-hidden
        />
        علاقه‌مندم
      </button>
    </div>
  );
}

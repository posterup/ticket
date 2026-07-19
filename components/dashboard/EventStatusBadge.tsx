import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/events/labels";
import type { EventStatus } from "@/types";

const STATUS_DOT: Record<EventStatus, string> = {
  published: "bg-success",
  draft: "bg-faint",
  cancelled: "bg-danger",
  completed: "bg-muted",
};

/** Neutral status pill with a semantic colored dot. */
export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-2.5 py-1 text-xs text-muted">
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {STATUS_LABELS[status]}
    </span>
  );
}

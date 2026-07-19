import { Ticket } from "lucide-react";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/** Gishe wordmark: a compact accent mark paired with the platform name. */
export function Logo({ className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground shadow-sm">
        <Ticket className="size-5" strokeWidth={2} aria-hidden />
      </span>
      <span className="text-lg font-bold tracking-tight text-foreground">
        پوستر
      </span>
    </span>
  );
}

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/**
 * Poster brand lockup: the outlined rounded-square mark with an offset dot,
 * paired with the platform name. The mark uses the accent token (currentColor)
 * so it stays on-brand in both light and dark themes.
 */
export function Logo({ className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 128 128"
        className="size-8 text-accent"
        fill="none"
        aria-hidden
      >
        <rect
          x="18"
          y="18"
          width="92"
          height="92"
          rx="24"
          stroke="currentColor"
          strokeWidth="6"
        />
        <circle cx="42" cy="86" r="12" fill="currentColor" />
      </svg>
      <span className="text-lg font-bold tracking-tight text-foreground">
        پوستر
      </span>
    </span>
  );
}

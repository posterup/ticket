import { cn } from "@/lib/utils";

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Workspace cover/banner. Renders the uploaded image when present, otherwise a
 * soft on-brand gradient deterministically seeded by the slug (stable across
 * server/client renders).
 */
export function WorkspaceBanner({
  seed,
  banner,
  className,
}: {
  seed: string;
  banner?: string;
  className?: string;
}) {
  if (banner) {
    return (
      <div
        role="img"
        aria-label="بنر فضای کاری"
        className={cn("bg-cover bg-center", className)}
        style={{ backgroundImage: `url(${banner})` }}
      />
    );
  }

  const h = hash(seed);
  const angle = h % 360;
  const hue1 = 290 + (h % 50); // pink → violet
  const hue2 = 230 + ((h >> 5) % 80); // violet → cyan

  return (
    <div
      aria-hidden
      className={cn(className)}
      style={{
        background: `linear-gradient(${angle}deg, hsl(${hue1} 85% 90%), hsl(${hue2} 80% 88%))`,
      }}
    />
  );
}

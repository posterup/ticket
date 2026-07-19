import {
  Music,
  Palette,
  Cpu,
  GraduationCap,
  Trophy,
  UtensilsCrossed,
  Briefcase,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/** Map an event's tags to a representative icon (first match wins). */
const CATEGORY_ICONS: { match: string[]; icon: LucideIcon }[] = [
  { match: ["موسیقی", "کنسرت"], icon: Music },
  { match: ["هنر", "نقاشی", "نمایشگاه", "عکاسی"], icon: Palette },
  { match: ["فناوری", "برنامه‌نویسی", "میتاپ", "استارتاپ"], icon: Cpu },
  { match: ["آموزش", "کارگاه", "دوره"], icon: GraduationCap },
  { match: ["ورزش", "دو", "همگانی"], icon: Trophy },
  { match: ["غذا", "فستیوال"], icon: UtensilsCrossed },
  { match: ["کسب‌وکار", "همایش", "سمینار"], icon: Briefcase },
];

function iconForTags(tags: string[]): LucideIcon {
  for (const { match, icon } of CATEGORY_ICONS) {
    if (tags.some((t) => match.includes(t))) return icon;
  }
  return CalendarDays;
}

// Neutral, monochrome gradient pairs (on-brand: no branding color).
const GRADIENTS = [
  "from-neutral-800 to-neutral-950",
  "from-neutral-900 to-neutral-700",
  "from-neutral-700 to-neutral-900",
  "from-neutral-950 to-neutral-600",
  "from-neutral-600 to-neutral-900",
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Event cover art. Renders an uploaded poster when present; otherwise a
 * deterministic monochrome gradient seeded by the event id, watermarked with a
 * category icon — so every event has a visual identity without external assets.
 */
export function EventCover({
  seed,
  tags,
  poster = null,
  className,
}: {
  seed: string;
  tags: string[];
  poster?: string | null;
  className?: string;
}) {
  if (poster) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={poster}
        alt=""
        className={cn("w-full object-cover", className)}
      />
    );
  }

  const Icon = iconForTags(tags);
  const gradient = GRADIENTS[hash(seed) % GRADIENTS.length];

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-gradient-to-br",
        gradient,
        className,
      )}
      aria-hidden
    >
      <Icon className="absolute -bottom-4 -start-3 size-28 text-white/10" strokeWidth={1.25} />
      <Icon className="absolute end-4 top-4 size-6 text-white/25" strokeWidth={1.5} />
    </div>
  );
}

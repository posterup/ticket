"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, QrCode, TrendingUp, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { fadeUpItem } from "@/lib/motion";

/*
  Abstract, monochrome hero illustration built entirely from HTML/CSS/Tailwind
  (per DESIGN.md: geometric shapes / abstract dashboard, no external images).
  Neutrals carry the composition; color appears only to communicate meaning
  (green for active status and positive change). All figures are illustrative.
*/

// Fixed QR-like pattern (kept static to avoid hydration mismatch).
const QR_PATTERN = [
  1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1,
  0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1,
];

const WEEKLY_BARS = [38, 52, 44, 68, 58, 82, 72];

function useFloat(delay: number) {
  const reduce = useReducedMotion();
  if (reduce) return {};
  return {
    animate: { y: [0, -10, 0] },
    transition: {
      duration: 6,
      ease: "easeInOut" as const,
      repeat: Infinity,
      delay,
    },
  };
}

function FloatingCard({
  className,
  delay,
  children,
}: {
  className?: string;
  delay: number;
  children: React.ReactNode;
}) {
  const float = useFloat(delay);
  return (
    <motion.div
      {...float}
      className={cn(
        "rounded-lg border border-border bg-card/95 p-4 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export function HeroIllustration() {
  return (
    <motion.div
      variants={fadeUpItem}
      className="relative mx-auto mt-16 w-full max-w-2xl px-2 sm:mt-20"
      aria-hidden
    >
      {/* Primary ticket card */}
      <FloatingCard delay={0} className="mx-auto max-w-md p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-faint">بلیت ورود</span>
            <span className="text-sm font-semibold text-foreground">
              همایش سالانه فناوری
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <span className="size-1.5 rounded-full bg-success" />
            فعال
          </span>
        </div>

        <div className="flex items-stretch gap-4 px-5 py-4">
          <div className="grid grid-cols-7 gap-[3px] rounded-md border border-border bg-subtle p-2.5">
            {QR_PATTERN.map((cell, i) => (
              <span
                key={i}
                className={cn(
                  "size-2 rounded-[2px]",
                  cell ? "bg-foreground" : "bg-transparent",
                )}
              />
            ))}
          </div>

          <div className="flex flex-1 flex-col justify-center gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">دسته</span>
              <span className="font-medium text-foreground">VIP</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-muted">ردیف</span>
              <span className="font-medium text-foreground">A - ۱۲</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-muted">قیمت</span>
              <span className="font-semibold text-foreground">
                ۴۵۰٬۰۰۰ تومان
              </span>
            </div>
          </div>
        </div>
      </FloatingCard>

      {/* Weekly sales card */}
      <FloatingCard
        delay={1.2}
        className="absolute -top-10 -left-2 w-44 sm:-left-10 sm:w-52"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-faint">فروش هفتگی</span>
          <QrCode className="size-4 text-faint" aria-hidden />
        </div>
        <div className="flex h-16 items-end gap-1.5">
          {WEEKLY_BARS.map((h, i) => (
            <span
              key={i}
              style={{ height: `${h}%` }}
              className={cn(
                "flex-1 rounded-sm",
                i === WEEKLY_BARS.length - 1
                  ? "bg-foreground"
                  : "bg-foreground/15",
              )}
            />
          ))}
        </div>
      </FloatingCard>

      {/* Revenue stat card */}
      <FloatingCard
        delay={0.6}
        className="absolute -bottom-12 -right-2 w-48 sm:-right-8 sm:w-56"
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-subtle text-foreground">
            <TrendingUp className="size-4" aria-hidden />
          </span>
          <span className="text-xs text-faint">درآمد امروز</span>
        </div>
        <div className="text-lg font-bold text-foreground">۱۲٬۴۸۰٬۰۰۰</div>
        <div className="mt-1 flex items-center gap-1 text-xs text-success">
          <ArrowUpRight className="size-3.5" aria-hidden />
          <span>۱۸٪ نسبت به دیروز</span>
        </div>
      </FloatingCard>

      {/* Attendees mini badge */}
      <FloatingCard
        delay={1.8}
        className="absolute top-16 -right-1 hidden items-center gap-2 !p-3 md:flex"
      >
        <span className="grid size-8 place-items-center rounded-md bg-subtle text-foreground">
          <Users className="size-4" aria-hidden />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground">۳۲۷</span>
          <span className="text-[0.6875rem] text-faint">شرکت‌کننده</span>
        </div>
      </FloatingCard>
    </motion.div>
  );
}

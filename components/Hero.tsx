"use client";

import { motion } from "framer-motion";

import { staggerContainer, fadeUpItem } from "@/lib/motion";
import { HeroButtons } from "@/components/HeroButtons";
import { HeroIllustration } from "@/components/HeroIllustration";

/**
 * Centered, manifesto-style hero. Text column is capped near 700px per the
 * product brief; the abstract illustration flows beneath it. The whole block
 * reveals as a single gentle stagger on load.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Calm background: a single soft accent glow at the top center */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] bg-[radial-gradient(60%_60%_at_50%_0%,var(--color-accent-soft)_0%,transparent_70%)] opacity-70" />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col items-center px-4 pt-32 pb-24 text-center sm:px-6 sm:pt-36"
      >
        <motion.h1
          variants={fadeUpItem}
          className="mx-auto max-w-[44rem] text-5xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-6xl"
        >
          پوستر
        </motion.h1>

        <motion.p
          variants={fadeUpItem}
          className="mx-auto mt-6 max-w-[40rem] text-xl font-medium text-foreground sm:text-2xl"
        >
          پلتفرم برگزاری و بلیت‌فروشی تجربه و رویداد
        </motion.p>

        <motion.p
          variants={fadeUpItem}
          className="mx-auto mt-4 max-w-[38rem] text-base leading-relaxed text-muted sm:text-lg"
        >
          تجربه‌ها و رویدادهای جذاب اطرافتان را کشف کنید؛ و به کمک پوستر،
          رویدادهای خود را به‌سادگی بسازید، بلیت بفروشید و برگزار کنید.
        </motion.p>

        <div className="mt-9">
          <HeroButtons />
        </div>

        <HeroIllustration />
      </motion.div>
    </section>
  );
}

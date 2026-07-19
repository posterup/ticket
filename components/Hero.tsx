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
          className="mx-auto max-w-[44rem] text-4xl font-bold leading-[1.25] tracking-tight text-foreground sm:text-5xl sm:leading-[1.2]"
        >
          مدیریت حرفه‌ای رویداد، فروش آسان بلیت
        </motion.h1>

        <motion.p
          variants={fadeUpItem}
          className="mx-auto mt-6 max-w-[38rem] text-lg text-muted sm:text-xl"
        >
          همه ابزارهای موردنیاز برای ایجاد، مدیریت و فروش بلیت رویدادها در یک
          پلتفرم واحد.
        </motion.p>

        <motion.p
          variants={fadeUpItem}
          className="mx-auto mt-4 max-w-[36rem] text-base leading-relaxed text-muted"
        >
          کسب‌وکارها و سازمان‌ها می‌توانند رویدادها، مخاطبان، فروش بلیت و عملیات
          ورود را از یک داشبورد واحد مدیریت کنند. ساده، سریع و حرفه‌ای.
        </motion.p>

        <div className="mt-9">
          <HeroButtons />
        </div>

        <HeroIllustration />
      </motion.div>
    </section>
  );
}

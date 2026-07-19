"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar } from "lucide-react";

import { cn } from "@/lib/utils";
import { fadeUpItem } from "@/lib/motion";
import { buttonVariants } from "@/components/ui/button";

/**
 * Hero call-to-action pair: create a ticket (primary) or browse public
 * events (secondary).
 */
export function HeroButtons() {
  return (
    <motion.div
      variants={fadeUpItem}
      className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
    >
      <Link
        href="/tickets/create"
        className={cn(
          buttonVariants({ variant: "primary", size: "lg" }),
          "group",
        )}
      >
        ایجاد بلیت
        <ArrowLeft
          className="transition-transform duration-200 group-hover:-translate-x-1"
          aria-hidden
        />
      </Link>

      <Link
        href="/events"
        className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
      >
        <Calendar aria-hidden />
        مشاهده رویدادها
      </Link>
    </motion.div>
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar } from "lucide-react";

import { cn } from "@/lib/utils";
import { fadeUpItem } from "@/lib/motion";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Hero call-to-action pair. Primary routes to the ticket creation wizard;
 * the secondary "view events" action is intentionally disabled and flagged
 * as coming soon.
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

      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label="مشاهده رویدادها، به‌زودی در دسترس"
        className={cn(
          buttonVariants({ variant: "secondary", size: "lg" }),
          "cursor-not-allowed opacity-60",
        )}
      >
        <Calendar aria-hidden />
        مشاهده رویدادها
        <Badge variant="accent" size="sm" className="me-1">
          به‌زودی
        </Badge>
      </button>
    </motion.div>
  );
}

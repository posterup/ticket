"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { SIDEBAR_ITEMS, CREATE_HREF, isActive } from "@/components/dashboard/nav";

/**
 * Mobile navigation drawer: a hamburger trigger in the header that opens a
 * slide-in panel exposing every dashboard section (the desktop sidebar's
 * destinations), which the bottom nav can't fit. Hidden on desktop (`lg:`).
 */
export function MobileNavDrawer() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="باز کردن منو"
        aria-expanded={open}
        className="grid size-10 shrink-0 place-items-center rounded-md border border-border text-foreground outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring/40 lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <motion.div
              className="absolute inset-0 bg-foreground/40"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col border-e border-border bg-card px-4 py-5 shadow-xl"
              initial={reduce ? false : { x: "100%" }}
              animate={{ x: 0 }}
              exit={reduce ? undefined : { x: "100%" }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">منو</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="بستن منو"
                  className="grid size-9 place-items-center rounded-md text-muted outline-none transition-colors hover:bg-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>

              <Link
                href={CREATE_HREF}
                className={cn(buttonVariants({ variant: "primary", size: "md" }), "mt-4")}
              >
                <Plus aria-hidden />
                ساخت رویداد
              </Link>

              <nav
                className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto"
                aria-label="ناوبری داشبورد"
              >
                {SIDEBAR_ITEMS.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-subtle text-foreground"
                          : "text-muted hover:bg-subtle hover:text-foreground",
                      )}
                    >
                      <Icon className="size-[1.15rem]" aria-hidden />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

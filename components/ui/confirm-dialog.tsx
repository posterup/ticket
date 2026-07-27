"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** True at the `lg` breakpoint (desktop) — drives sheet-vs-popup presentation. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

/**
 * A confirm dialog: a bottom sheet on mobile, a centered popup on desktop
 * (mirrors {@link ContactSheet}'s responsive presentation). The body content is
 * centered; the confirm/cancel actions sit side by side at the bottom.
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel = "تأیید",
  cancelLabel = "انصراف",
  confirmLoading = false,
  danger = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmLoading?: boolean;
  /** Tint the confirm button as destructive. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const isDesktop = useIsDesktop();

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="confirm-dialog"
          className="fixed inset-0 z-[70]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={confirmLoading ? undefined : onCancel}
          />

          {/* Centering layer (desktop popup); on mobile the panel anchors to the bottom itself. */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0",
              isDesktop && "flex items-center justify-center p-4",
            )}
          >
            <motion.div
              className={cn(
                "pointer-events-auto flex flex-col border-border bg-background shadow-2xl shadow-foreground/10",
                isDesktop
                  ? "w-full max-w-sm rounded-2xl border"
                  : "absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-2xl border-t",
              )}
              role="alertdialog"
              aria-modal="true"
              aria-label={title}
              initial={
                reduce ? false : isDesktop ? { opacity: 0, scale: 0.96 } : { y: "100%" }
              }
              animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : isDesktop
                    ? { opacity: 0, scale: 0.96 }
                    : { y: "100%" }
              }
              transition={{ duration: isDesktop ? 0.2 : 0.3, ease: EASE_OUT }}
            >
              {/* Centered content */}
              <div className="flex flex-col items-center gap-2 px-6 pb-6 pt-7 text-center">
                {title ? (
                  <h2 className="text-base font-semibold text-foreground">
                    {title}
                  </h2>
                ) : null}
                {children}
              </div>

              {/* Actions — side by side */}
              <div className="grid grid-cols-2 gap-3 border-t border-border p-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={onCancel}
                  disabled={confirmLoading}
                >
                  {cancelLabel}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className={cn(
                    "w-full",
                    danger &&
                      "bg-danger text-background shadow-none hover:brightness-110",
                  )}
                  onClick={onConfirm}
                  disabled={confirmLoading}
                >
                  {confirmLabel}
                </Button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

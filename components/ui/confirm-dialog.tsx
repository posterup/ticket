"use client";

import { useEffect, useState } from "react";
import { Modal } from "@heroui/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** True at the `lg` breakpoint (desktop) — drives sheet-vs-popup placement. */
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
 * Confirm dialog — HeroUI <Modal>. Centered popup on desktop, bottom sheet on
 * mobile (via `placement`). The confirm/cancel actions sit side by side. Public
 * API is unchanged from the previous bespoke version.
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
  const isDesktop = useIsDesktop();

  return (
    <Modal
      isOpen={open}
      onOpenChange={(next) => {
        if (!next && !confirmLoading) onCancel();
      }}
    >
      <Modal.Backdrop isDismissable={!confirmLoading} />
      <Modal.Container
        placement={isDesktop ? "center" : "bottom"}
        size="sm"
      >
        <Modal.Dialog aria-label={title}>
          {/* Centered content */}
          <div className="flex flex-col items-center gap-2 px-6 pb-6 pt-7 text-center">
            {title ? (
              <Modal.Heading className="text-base font-semibold text-foreground">
                {title}
              </Modal.Heading>
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
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  );
}

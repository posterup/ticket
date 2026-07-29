"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellRing } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isNotified, setNotified } from "@/lib/notify";

/**
 * Reminder toggle used for the "notify me" (sales not started) and "waitlist"
 * (sold out) states. If the visitor isn't logged in it routes to login,
 * returning here afterwards; once logged in it toggles a persisted reminder and
 * flips to an active label.
 */
export function NotifyMe({
  eventId,
  loggedIn,
  idleLabel = "خبرم کن",
  activeLabel = "خبرتان می‌کنیم",
  size = "lg",
  className,
}: {
  eventId: string;
  /**
   * Resolved on the server by the page that renders this, rather than read
   * from the browser — which also removes the flash of the wrong label on
   * first paint.
   */
  loggedIn: boolean;
  idleLabel?: string;
  activeLabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [notified, setNotifiedState] = useState(false);

  useEffect(() => {
    setNotifiedState(isNotified(eventId));
  }, [eventId]);

  function onClick() {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const next = !notified;
    setNotifiedState(next);
    setNotified(eventId, next);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      onClick={onClick}
      aria-pressed={notified}
      className={className}
    >
      {notified ? (
        <>
          <BellRing aria-hidden />
          {activeLabel}
        </>
      ) : (
        <>
          <Bell aria-hidden />
          {idleLabel}
        </>
      )}
    </Button>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellRing } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isLoggedIn } from "@/lib/auth";
import { isNotified, setNotified } from "@/lib/notify";

/**
 * "Notify me" button shown while ticket sales haven't started. If the visitor
 * isn't logged in, it routes to login (returning here afterwards). Once logged
 * in, it toggles a persisted reminder and flips to an active state.
 */
export function NotifyMe({ eventId }: { eventId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [notified, setNotifiedState] = useState(false);

  useEffect(() => {
    setNotifiedState(isNotified(eventId));
  }, [eventId]);

  function onClick() {
    if (!isLoggedIn()) {
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
      size="lg"
      onClick={onClick}
      aria-pressed={notified}
      className="mt-4 w-full"
    >
      {notified ? (
        <>
          <BellRing aria-hidden />
          خبرتان می‌کنیم
        </>
      ) : (
        <>
          <Bell aria-hidden />
          خبرم کن
        </>
      )}
    </Button>
  );
}

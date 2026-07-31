"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useApi } from "@/lib/client/api";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { FeaturedEvents } from "@/components/landing/FeaturedEvents";
import { FollowPages } from "@/components/landing/FollowPages";
import { Footer } from "@/components/Footer";

interface Me {
  user: unknown | null;
  memberships: unknown[];
}

/**
 * The organizer pitch. `/` belongs to attendees (it lands on explore), so the
 * marketing page lives here and speaks only to hosts and event managers.
 *
 * A visitor who already manages a workspace has read this page's argument
 * already, so they go straight to their dashboard. A signed-in attendee with no
 * workspace stays — they are exactly who this page is trying to convince.
 * Resolved client-side, so the page paints immediately for logged-out visitors.
 */
export default function HostsPage() {
  const router = useRouter();
  const { data } = useApi<Me>("/api/auth/me");

  useEffect(() => {
    if (data?.user && data.memberships.length > 0) {
      router.replace("/dashboard/events");
    }
  }, [data, router]);

  return (
    <>
      <Header />
      <main>
        <Hero />
        <FeaturedEvents />
        <FollowPages />
      </main>
      <Footer />
    </>
  );
}

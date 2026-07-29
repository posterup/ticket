"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useApi } from "@/lib/client/api";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { FeaturedEvents } from "@/components/landing/FeaturedEvents";
import { FollowPages } from "@/components/landing/FollowPages";
import { Footer } from "@/components/Footer";

export default function Home() {
  const router = useRouter();
  // The landing page is for logged-out visitors; signed-in users go straight
  // to their home. Resolved client-side, so the marketing page paints
  // immediately for the visitors it is actually for.
  const { data } = useApi<{ user: unknown | null }>("/api/auth/me");

  useEffect(() => {
    if (data?.user) router.replace("/dashboard/events");
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

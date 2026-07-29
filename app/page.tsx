import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth/guards";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { FeaturedEvents } from "@/components/landing/FeaturedEvents";
import { FollowPages } from "@/components/landing/FollowPages";
import { Footer } from "@/components/Footer";

export default async function Home() {
  // The landing page is for logged-out visitors; signed-in users go straight
  // to their home (list of events).
  const loggedIn = (await getCurrentUser()) !== null;
  if (loggedIn) redirect("/dashboard/events");

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

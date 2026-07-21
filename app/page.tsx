import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { FeaturedEvents } from "@/components/landing/FeaturedEvents";
import { FollowPages } from "@/components/landing/FollowPages";
import { Footer } from "@/components/Footer";

export default async function Home() {
  // The landing page is for logged-out visitors; signed-in users go straight
  // to their home (list of events).
  const loggedIn = (await cookies()).get(AUTH_COOKIE)?.value === "1";
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

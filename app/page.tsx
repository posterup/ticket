import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { FeaturedEvents } from "@/components/landing/FeaturedEvents";
import { FollowPages } from "@/components/landing/FollowPages";
import { Footer } from "@/components/Footer";

export default function Home() {
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

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getEventByIdOrSlug, listTickets } from "@/lib/server";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import {
  CheckoutForm,
  type CheckoutTicket,
} from "@/components/checkout/CheckoutForm";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ticket?: string }>;
}

export const metadata: Metadata = { title: "تهیه بلیت | پوستر" };

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { ticket } = await searchParams;
  const event = getEventByIdOrSlug(id);
  if (!event) notFound();
  const tickets = listTickets(event.id);
  if (tickets.length === 0) notFound();

  const initialTicketId =
    tickets.find((t) => t.id === ticket)?.id ?? tickets[0].id;
  const checkoutTickets: CheckoutTicket[] = tickets.map((t) => ({
    id: t.id,
    name: t.name,
    price: t.price,
    capacity: t.capacity,
    category: t.category,
  }));

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            تهیه بلیت
          </h1>
          <p className="mt-1 text-sm text-muted">{event.title}</p>
        </div>
        <CheckoutForm
          eventId={event.id}
          eventTitle={event.title}
          tickets={checkoutTickets}
          initialTicketId={initialTicketId}
        />
      </main>
      <Footer />
    </div>
  );
}

"use client";

import { use } from "react";

import { useApi } from "@/lib/client/api";
import { AsyncState } from "@/components/ui/async-state";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import {
  CheckoutForm,
  type CheckoutTicket,
} from "@/components/checkout/CheckoutForm";
import type { Event, TicketType } from "@/types";

interface PageData {
  event: Event;
  tickets: TicketType[];
  /** Present when signed in; seeds the buyer fields. */
  viewer?: { fullName: string; phone: string };
}

export default function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ticket?: string; session?: string }>;
}) {
  const { id } = use(params);
  const { ticket, session } = use(searchParams);
  const { data, error, loading, reload } = useApi<PageData>(
    `/api/events/${id}/page-data`,
  );

  if (!data || data.tickets.length === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <PublicHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
          <AsyncState
            loading={loading}
            error={error}
            empty={Boolean(data && data.tickets.length === 0)}
            emptyLabel="بلیتی برای این رویداد تعریف نشده است."
            onRetry={reload}
          variant="page" rows={1} />
        </main>
        <Footer />
      </div>
    );
  }

  const tickets: CheckoutTicket[] = data.tickets.map((t) => ({
    id: t.id,
    name: t.name,
    price: t.price,
    capacity: t.capacity,
    category: t.category,
  }));
  const initialTicketId =
    tickets.find((t) => t.id === ticket)?.id ?? tickets[0].id;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <CheckoutForm
          eventId={data.event.id}
          eventTitle={data.event.title}
          tickets={tickets}
          initialTicketId={initialTicketId}
          sessions={data.event.sessions}
          initialSessionId={session}
          viewer={data.viewer}
        />
      </main>
      <Footer />
    </div>
  );
}

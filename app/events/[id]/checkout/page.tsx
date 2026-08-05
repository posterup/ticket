"use client";

import { use } from "react";
import Link from "next/link";

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

  /**
   * A free event has no checkout to reach.
   *
   * The event page no longer offers one — `resolveBuyState` returns `none` when
   * every ticket is free — but the route stays reachable by hand, by an old
   * link, and by a bookmark from before this changed. Landing on a payment form
   * for something that costs nothing is the confusing end of that, so this says
   * what is actually true and points back.
   *
   * `every`, matching `resolveBuyState`: a mixed free/paid event is a paid event
   * and belongs here. So does a paid order that a discount code takes to zero —
   * that is decided at submit, not at arrival, and never passes through this.
   */
  if (data.tickets.every((t) => t.price === 0)) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <PublicHeader />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16 sm:px-6">
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <h1 className="text-lg font-bold text-foreground">
              این رویداد بلیت نمی‌خواهد
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
              ورود به «{data.event.title}» آزاد است. کافی است در زمان اعلام‌شده
              به محل مراجعه کنید.
            </p>
            <Link
              href={`/events/${id}`}
              className="mt-6 inline-block text-sm font-medium text-accent-text underline-offset-4 hover:underline"
            >
              مشاهدهٔ جزئیات رویداد
            </Link>
          </div>
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
          eventVenue={data.event.venue?.name}
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

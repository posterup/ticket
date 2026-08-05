import { it, expect, afterAll, beforeAll } from "vitest";

import { POST as CREATE_ORDER } from "@/app/api/orders/route";
import { POST as PAY } from "@/app/api/orders/[id]/pay/route";
import { GET as CALLBACK } from "@/app/api/payments/callback/route";
import type { Order } from "@/types";

import {
  ctx,
  data,
  describeApi,
  dropTrackedEvents,
  errorCode,
  parse,
  req,
  signOut,
  trackEvent,
  trackVenue,
} from "./helpers";

// Remove the throwaway events, venues and orders this suite creates.
afterAll(dropTrackedEvents);

const BUYER_PHONE = "09121234567";

/** A throwaway paid event, so tests never contend over seeded inventory. */
async function paidEvent(capacity = 5) {
  const { db } = await import("@/lib/server/db");
  const workspace = await db.workspace.findFirstOrThrow({ select: { id: true } });
  const venue = await db.venue.create({
    data: { name: "تالار", city: "تهران", address: "نشانی", capacity: 100 },
  });
  trackVenue(venue.id);
  const event = await db.event.create({
    data: {
      workspaceId: workspace.id,
      venueId: venue.id,
      title: "رویداد پرداخت",
      description: "",
      mode: "ONE_TIME",
      status: "PUBLISHED",
    },
  });
  const type = await db.ticketType.create({
    data: {
      eventId: event.id,
      name: "عادی",
      price: 250_000,
      capacity,
      salesStartAt: new Date("2020-01-01T00:00:00.000Z"),
      salesEndAt: new Date("2030-01-01T00:00:00.000Z"),
      category: "GENERAL",
    },
  });
  return { eventId: trackEvent(event.id), ticketTypeId: type.id };
}

async function placeOrder(quantity = 1): Promise<Order> {
  const { eventId, ticketTypeId } = await paidEvent();
  const { order } = data(
    await parse<{ order: Order }>(
      await CREATE_ORDER(
        req("POST", "/", {
          eventId,
          items: [{ ticketTypeId, quantity }],
          buyerName: "سارا محمدی",
          buyerPhone: BUYER_PHONE,
        }),
      ),
    ),
  );
  return order;
}

/** The gateway hands the buyer back here; this is that request. */
function callbackRequest(redirectUrl: string): Request {
  return new Request(redirectUrl, { method: "GET" });
}

beforeAll(async () => {
  process.env.PAYMENT_PROVIDER = "mock";
  process.env.APP_URL = "http://test.local";
  if (process.env.DATABASE_URL) await signOut();
});

describeApi("POST /api/orders/:id/pay", () => {
  it("returns somewhere to send the buyer", async () => {
    const order = await placeOrder();
    const parsed = await parse<{ redirectUrl: string; authority: string }>(
      await PAY(req("POST", "/", { phone: BUYER_PHONE }), ctx({ id: order.id })),
    );
    expect(parsed.status).toBe(200);

    const { redirectUrl, authority } = data(parsed);
    expect(authority).toMatch(/^mock_/);
    expect(redirectUrl).toContain("/api/payments/callback");

    const { db } = await import("@/lib/server/db");
    const payment = await db.payment.findFirstOrThrow({ where: { authority } });
    expect(payment.status).toBe("REDIRECTED");
    // Recorded in Toman, the currency the product quotes in.
    expect(payment.amount).toBe(order.total);
  });

  it("refuses a stranger holding only the order id", async () => {
    // /cancel has always asked for proof; /pay touches money and did not.
    const order = await placeOrder();
    const parsed = await parse(await PAY(req("POST", "/"), ctx({ id: order.id })));
    expect(parsed.status).toBe(403);
    expect(errorCode(parsed)).toBe("FORBIDDEN");

    const wrongPhone = await parse(
      await PAY(req("POST", "/", { phone: "09120000000" }), ctx({ id: order.id })),
    );
    expect(wrongPhone.status).toBe(403);
  });

  it("404s an unknown order", async () => {
    const parsed = await parse(await PAY(req("POST", "/", { phone: BUYER_PHONE }), ctx({ id: "nope" })));
    expect(parsed.status).toBe(404);
  });

  it("refuses an order that is already settled", async () => {
    const order = await placeOrder();
    const { markOrderPaid } = await import("@/lib/server/orders");
    await markOrderPaid(order.id, { provider: "mock" });

    const parsed = await parse(await PAY(req("POST", "/", { phone: BUYER_PHONE }), ctx({ id: order.id })));
    expect(parsed.status).toBe(409);
    expect(errorCode(parsed)).toBe("CONFLICT");
  });

  it("refuses an order whose hold has lapsed", async () => {
    const order = await placeOrder();
    const { db } = await import("@/lib/server/db");
    await db.order.update({
      where: { id: order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const parsed = await parse(await PAY(req("POST", "/", { phone: BUYER_PHONE }), ctx({ id: order.id })));
    expect(parsed.status).toBe(409);
  });
});

describeApi("GET /api/payments/callback", () => {
  it("settles the order and issues tickets", async () => {
    const order = await placeOrder(2);
    const { redirectUrl } = data(
      await parse<{ redirectUrl: string }>(
        await PAY(req("POST", "/", { phone: BUYER_PHONE }), ctx({ id: order.id })),
      ),
    );

    const res = await CALLBACK(callbackRequest(redirectUrl));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain(`/orders/${order.code}`);

    const { db } = await import("@/lib/server/db");
    const settled = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(settled.status).toBe("PAID");
    expect(await db.ticket.count({ where: { orderId: order.id } })).toBe(2);

    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const type = await db.ticketType.findUniqueOrThrow({
      where: { id: item.ticketTypeId },
    });
    expect(type.sold).toBe(2);
    expect(type.reserved).toBe(0);
  });

  it("issues no extra tickets when the callback arrives twice", async () => {
    // A duplicate callback, or the buyer using the back button.
    const order = await placeOrder(2);
    const { redirectUrl } = data(
      await parse<{ redirectUrl: string }>(
        await PAY(req("POST", "/", { phone: BUYER_PHONE }), ctx({ id: order.id })),
      ),
    );

    await CALLBACK(callbackRequest(redirectUrl));
    const second = await CALLBACK(callbackRequest(redirectUrl));
    expect(second.status).toBe(303);

    const { db } = await import("@/lib/server/db");
    expect(await db.ticket.count({ where: { orderId: order.id } })).toBe(2);
  });

  it("releases the seats when the buyer abandons the gateway", async () => {
    const order = await placeOrder(2);
    const { redirectUrl } = data(
      await parse<{ redirectUrl: string }>(
        await PAY(req("POST", "/", { phone: BUYER_PHONE }), ctx({ id: order.id })),
      ),
    );
    // Zarinpal signals an abandoned or rejected payment with Status=NOK.
    const nok = redirectUrl.replace("Status=OK", "Status=NOK");

    const res = await CALLBACK(callbackRequest(nok));
    expect(res.headers.get("location")).toContain("state=failed");

    const { db } = await import("@/lib/server/db");
    const failed = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(failed.status).toBe("FAILED");
    expect(await db.ticket.count({ where: { orderId: order.id } })).toBe(0);

    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const type = await db.ticketType.findUniqueOrThrow({
      where: { id: item.ticketTypeId },
    });
    // The seats must go back, or the event slowly sells out to nobody.
    expect(type.reserved).toBe(0);
    expect(type.sold).toBe(0);
  });

  it("releases the seats when the gateway rejects the payment", async () => {
    const order = await placeOrder(1);
    const { redirectUrl } = data(
      await parse<{ redirectUrl: string }>(
        // `?fail=1` makes the mock refuse at verify time, which is the case
        // where the buyer did return but the money did not.
        await PAY(
          req("POST", "/?fail=1", { phone: BUYER_PHONE }),
          ctx({ id: order.id }),
        ),
      ),
    );

    const res = await CALLBACK(callbackRequest(redirectUrl.replace("Status=NOK", "Status=OK")));
    expect(res.headers.get("location")).toContain("state=failed");

    const { db } = await import("@/lib/server/db");
    const failed = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(failed.status).toBe("FAILED");
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const type = await db.ticketType.findUniqueOrThrow({
      where: { id: item.ticketTypeId },
    });
    expect(type.reserved).toBe(0);
  });

  it("sends a caller with no order id home rather than erroring", async () => {
    const res = await CALLBACK(
      new Request("http://test.local/api/payments/callback"),
    );
    expect(res.status).toBe(303);
  });
});

describeApi("gateway selection", () => {
  it("defaults to the mock, so a fresh clone can check out", async () => {
    const previous = process.env.PAYMENT_PROVIDER;
    delete process.env.PAYMENT_PROVIDER;

    const { paymentGateway } = await import("@/lib/server/payments");
    expect(paymentGateway().provider).toBe("mock");

    process.env.PAYMENT_PROVIDER = previous;
  });

  it("selects Zarinpal only when asked", async () => {
    const previous = process.env.PAYMENT_PROVIDER;
    const { paymentGateway } = await import("@/lib/server/payments");

    process.env.PAYMENT_PROVIDER = "zarinpal";
    expect(paymentGateway().provider).toBe("zarinpal");
    process.env.PAYMENT_PROVIDER = "zarinpal-sandbox";
    expect(paymentGateway().provider).toBe("zarinpal-sandbox");

    process.env.PAYMENT_PROVIDER = previous;
  });
});

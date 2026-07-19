import { NextResponse } from "next/server";

import { createTicketType, listTickets } from "@/lib/server";
import type {
  ApiResponse,
  CreateTicketTypeInput,
  TicketCategory,
  TicketType,
} from "@/types";

const TICKET_CATEGORIES: readonly TicketCategory[] = [
  "general",
  "vip",
  "student",
  "early-bird",
  "backstage",
  "group",
];

/** GET /api/tickets — list ticket types, optionally filtered by `?eventId=`. */
export function GET(request: Request): NextResponse<ApiResponse<TicketType[]>> {
  const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
  return NextResponse.json({ data: listTickets(eventId) });
}

/** POST /api/tickets — create a ticket type. 400 on invalid body, 201 on success. */
export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<TicketType>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Request body must be valid JSON.", code: "INVALID_JSON" } },
      { status: 400 },
    );
  }

  const input = parseCreateTicketTypeInput(body);
  if (input === null) {
    return NextResponse.json(
      {
        error: {
          message:
            "Missing or invalid fields: eventId, name, price, capacity, salesStartAt, salesEndAt, category.",
          code: "INVALID_BODY",
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ data: createTicketType(input) }, { status: 201 });
}

/** Minimal, dependency-free validation of the ticket-type creation payload. */
function parseCreateTicketTypeInput(
  body: unknown,
): CreateTicketTypeInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const candidate = body as Record<string, unknown>;

  const {
    eventId,
    name,
    price,
    capacity,
    salesStartAt,
    salesEndAt,
    category,
  } = candidate;

  if (typeof eventId !== "string" || eventId.trim() === "") return null;
  if (typeof name !== "string" || name.trim() === "") return null;
  if (typeof price !== "number" || !Number.isInteger(price) || price < 0) {
    return null;
  }
  if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 0) {
    return null;
  }
  if (typeof salesStartAt !== "string" || typeof salesEndAt !== "string") {
    return null;
  }
  if (
    typeof category !== "string" ||
    !TICKET_CATEGORIES.includes(category as TicketCategory)
  ) {
    return null;
  }

  return candidate as unknown as CreateTicketTypeInput;
}

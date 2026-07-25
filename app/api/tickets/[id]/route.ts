import { NextResponse } from "next/server";

import { updateTicketType, type TicketTypeUpdate } from "@/lib/server";
import type { ApiResponse, TicketCategory, TicketType } from "@/types";

const TICKET_CATEGORIES: readonly TicketCategory[] = [
  "general",
  "vip",
  "student",
  "early-bird",
  "backstage",
  "group",
];

/**
 * PATCH /api/tickets/:id — edit a ticket type (name, price, capacity, sales
 * window, category, description). Any subset of fields may be sent.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<TicketType>>> {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Request body must be valid JSON.", code: "INVALID_JSON" } },
      { status: 400 },
    );
  }

  const patch = parseTicketTypeUpdate(body);
  if (patch === null) {
    return NextResponse.json(
      { error: { message: "No valid fields to update.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  const ticket = updateTicketType(id, patch);
  if (ticket === undefined) {
    return NextResponse.json(
      { error: { message: "Ticket type was not found.", code: "NOT_FOUND" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: ticket });
}

/** Validate the ticket-type patch, keeping only known, well-typed fields. */
function parseTicketTypeUpdate(body: unknown): TicketTypeUpdate | null {
  if (typeof body !== "object" || body === null) return null;
  const c = body as Record<string, unknown>;
  const patch: TicketTypeUpdate = {};

  if ("name" in c) {
    if (typeof c.name !== "string" || c.name.trim() === "") return null;
    patch.name = c.name.trim();
  }
  if ("price" in c) {
    if (typeof c.price !== "number" || !Number.isInteger(c.price) || c.price < 0) {
      return null;
    }
    patch.price = c.price;
  }
  if ("capacity" in c) {
    if (
      typeof c.capacity !== "number" ||
      !Number.isInteger(c.capacity) ||
      c.capacity < 0
    ) {
      return null;
    }
    patch.capacity = c.capacity;
  }
  if ("salesStartAt" in c) {
    if (typeof c.salesStartAt !== "string") return null;
    patch.salesStartAt = c.salesStartAt;
  }
  if ("salesEndAt" in c) {
    if (typeof c.salesEndAt !== "string") return null;
    patch.salesEndAt = c.salesEndAt;
  }
  if ("category" in c) {
    if (
      typeof c.category !== "string" ||
      !TICKET_CATEGORIES.includes(c.category as TicketCategory)
    ) {
      return null;
    }
    patch.category = c.category as TicketCategory;
  }
  if ("description" in c) {
    if (typeof c.description !== "string") return null;
    patch.description = c.description;
  }

  // Reject a sales window whose end precedes its start when both are provided.
  if (patch.salesStartAt && patch.salesEndAt && patch.salesEndAt < patch.salesStartAt) {
    return null;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

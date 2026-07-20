import { NextResponse } from "next/server";

import { updateVenue, type VenueUpdate } from "@/lib/server";
import type { ApiResponse, Venue } from "@/types";

/** PATCH /api/events/:id/venue — edit the event's location fields. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<Venue>>> {
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

  const patch = parseVenueUpdate(body);
  if (patch === null) {
    return NextResponse.json(
      { error: { message: "No valid venue fields to update.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  const venue = updateVenue(id, patch);
  if (venue === undefined) {
    return NextResponse.json(
      { error: { message: `Event "${id}" was not found.`, code: "NOT_FOUND" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: venue });
}

function parseVenueUpdate(body: unknown): VenueUpdate | null {
  if (typeof body !== "object" || body === null) return null;
  const c = body as Record<string, unknown>;
  const patch: VenueUpdate = {};

  for (const key of ["name", "province", "city", "address"] as const) {
    if (key in c) {
      if (typeof c[key] !== "string") return null;
      patch[key] = c[key] as string;
    }
  }
  if ("capacity" in c) {
    if (typeof c.capacity !== "number" || !Number.isInteger(c.capacity) || c.capacity < 0) {
      return null;
    }
    patch.capacity = c.capacity;
  }
  for (const key of ["lat", "lng"] as const) {
    if (key in c) {
      if (typeof c[key] !== "number") return null;
      patch[key] = c[key] as number;
    }
  }
  if ("hideAddress" in c) {
    if (typeof c.hideAddress !== "boolean") return null;
    patch.hideAddress = c.hideAddress;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

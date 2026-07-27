import { NextResponse } from "next/server";

import { setRegistrationStatus } from "@/lib/server";
import type { ApiResponse, EventRegistration, RegistrationStatus } from "@/types";

const STATUSES: readonly RegistrationStatus[] = [
  "pending",
  "accepted",
  "rejected",
];

/** PATCH /api/events/:id/registrations/:registrationId — accept/reject a request. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ registrationId: string }> },
): Promise<NextResponse<ApiResponse<EventRegistration>>> {
  const { registrationId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Request body must be valid JSON.", code: "INVALID_JSON" } },
      { status: 400 },
    );
  }

  const status = (body as Record<string, unknown>).status;
  if (typeof status !== "string" || !STATUSES.includes(status as RegistrationStatus)) {
    return NextResponse.json(
      { error: { message: "Invalid status.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  const registration = setRegistrationStatus(
    registrationId,
    status as RegistrationStatus,
  );
  if (registration === undefined) {
    return NextResponse.json(
      { error: { message: "Registration not found.", code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ data: registration });
}

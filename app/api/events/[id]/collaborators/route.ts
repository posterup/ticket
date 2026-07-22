import { NextResponse } from "next/server";

import { addCollaborator, listCollaborators } from "@/lib/server";
import type { ApiResponse, EventCollaborator, CollaboratorChannel } from "@/types";

const CHANNELS: readonly CollaboratorChannel[] = [
  "workspace",
  "email",
  "phone",
  "username",
];

/** GET /api/events/:id/collaborators — list collaborators/requests. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<EventCollaborator[]>>> {
  const { id } = await params;
  return NextResponse.json({ data: listCollaborators(id) });
}

/** POST /api/events/:id/collaborators — send a collaboration request. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<EventCollaborator>>> {
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

  const c = body as Record<string, unknown>;
  const channel = CHANNELS.includes(c.channel as CollaboratorChannel)
    ? (c.channel as CollaboratorChannel)
    : null;
  const label = typeof c.label === "string" ? c.label.trim() : "";
  const sub = typeof c.sub === "string" ? c.sub : "";
  if (channel === null || !label) {
    return NextResponse.json(
      { error: { message: "A channel and label are required.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  const collaborator = addCollaborator(id, {
    channel,
    label,
    sub,
    workspaceSlug: typeof c.workspaceSlug === "string" ? c.workspaceSlug : undefined,
    avatar: typeof c.avatar === "string" ? c.avatar : undefined,
  });
  return NextResponse.json({ data: collaborator });
}

import { NextResponse } from "next/server";

import { removeCollaborator } from "@/lib/server";
import type { ApiResponse } from "@/types";

/** DELETE /api/events/:id/collaborators/:collabId — cancel a request. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ collabId: string }> },
): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  const { collabId } = await params;
  if (!removeCollaborator(collabId)) {
    return NextResponse.json(
      { error: { message: "Collaborator not found.", code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ data: { id: collabId } });
}

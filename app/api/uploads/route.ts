import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/server/auth/guards";
import { fail, HttpError } from "@/lib/server/http";
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  UPLOAD_PREFIX,
  isUploadKind,
} from "@/lib/uploads";
import { z } from "zod";

/**
 * `POST /api/uploads` — a one-shot ticket to write one file to Blob.
 *
 * The browser uploads *directly* to Blob and this route only issues the token
 * for it. A poster is megabytes; routing those bytes through a function means
 * paying for the transfer twice and holding a connection open for the length of
 * someone's upstream. The file never touches this process.
 *
 * That is also why the limits live in the token rather than in a handler here:
 * `allowedContentTypes` and `maximumSizeInBytes` are enforced by Blob itself,
 * so a client that ignores them is refused at the storage edge and no function
 * runs at all.
 *
 * **The only route that does not return an `ApiResponse` envelope.** The body
 * shape here is Blob's own client protocol — `upload()` in the browser parses
 * it — so wrapping it in `{ data }` would break the handshake. `handler` is
 * therefore replaced by the explicit `catch` below, which keeps errors in the
 * house format even though successes cannot be.
 *
 * **The token is the authorisation.** `handleUpload` calls
 * `onBeforeGenerateToken` for the *request for a token* and
 * `onUploadCompleted` afterwards, and only the first can refuse — so every
 * check that matters happens there. An unauthenticated caller gets nothing to
 * upload with.
 */

/** `pathname` is chosen by the client, so it decides nothing but the folder. */
const payload = z.object({ kind: z.string() });

export async function POST(request: Request) {
  try {
    // Read once: `handleUpload` needs the parsed body, and a `Request` body can
    // only be consumed a single time.
    const body = (await request.json()) as HandleUploadBody;

    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        /**
         * Uploading is for signed-in organisers.
         *
         * Without this the route is an open, anonymous write endpoint against a
         * storage bucket that bills by the gigabyte — the sort of thing that is
         * discovered by a scanner long before it is discovered by a user.
         */
        await requireUser();

        const parsed = payload.safeParse(
          clientPayload ? JSON.parse(clientPayload) : {},
        );
        const kind = parsed.success ? parsed.data.kind : undefined;
        if (!isUploadKind(kind)) {
          throw new HttpError(400, "INVALID_BODY", "نوع بارگذاری نامعتبر است.");
        }

        return {
          allowedContentTypes: [...IMAGE_TYPES],
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          // `addRandomSuffix` keeps two people uploading `poster.jpg` from
          // overwriting each other, and keeps a guessable name from being a way
          // to read someone else's draft.
          addRandomSuffix: true,
          pathname: `${UPLOAD_PREFIX[kind]}/${Date.now()}`,
        };
      },
      onUploadCompleted: async () => {
        /**
         * Deliberately empty.
         *
         * Nothing is recorded here, because a completed upload is not yet a
         * poster: the URL becomes real only when the organiser saves the event
         * that references it. Writing a row here would create orphans for every
         * abandoned draft — and this callback does not run at all on localhost,
         * where there is no public URL for Blob to call back to, so anything
         * load-bearing in it would work in production and silently not in dev.
         */
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return fail(error.status, error.code, error.message, error.details);
    }
    // `handleUpload` throws on a bad signature or a malformed body; treating
    // that as a 400 keeps a stack trace out of the response.
    console.error("[uploads] token request failed", error);
    return fail(400, "INVALID_BODY", "بارگذاری ناموفق بود.");
  }
}

import { emailTaken, updateProfile } from "@/lib/server";
import { requireUser } from "@/lib/server/auth/guards";
import { handler, HttpError, ok, readJson } from "@/lib/server/http";
import { profileSchema } from "@/lib/server/schemas/auth";

/**
 * PATCH /api/me — edit your own profile.
 *
 * Phone is not editable here: it is the sign-in credential, so changing it
 * needs its own verification flow.
 */
export const PATCH = handler(async (request: Request) => {
  const patch = await readJson(request, profileSchema);
  const user = await requireUser();

  // Email is unique, so a collision must be a clear 409 rather than a
  // database error surfacing as a 500.
  if (patch.email && (await emailTaken(patch.email, user.id))) {
    throw new HttpError(409, "DUPLICATE", "این ایمیل قبلاً ثبت شده است.");
  }

  return ok(await updateProfile(user.id, patch));
});

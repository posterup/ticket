/** The signed-in user's own profile. */

import { db } from "./db";
import type { SessionUser } from "./auth/session";

export interface ProfileUpdate {
  fullName?: string;
  email?: string | null;
  avatarUrl?: string | null;
}

/**
 * Update the caller's own profile.
 *
 * Phone is deliberately absent: it is the sign-in credential, so changing it
 * needs its own verification flow rather than a field on this call.
 */
export async function updateProfile(
  userId: string,
  patch: ProfileUpdate,
): Promise<SessionUser> {
  const row = await db.user.update({
    where: { id: userId },
    data: {
      fullName: patch.fullName,
      // Empty clears rather than storing "".
      email: patch.email === undefined ? undefined : patch.email || null,
      avatarUrl:
        patch.avatarUrl === undefined ? undefined : patch.avatarUrl || null,
    },
    select: {
      id: true,
      phone: true,
      fullName: true,
      avatarUrl: true,
      platformAdmin: true,
    },
  });
  return row;
}

/** Whether an email is already taken by someone else. */
export async function emailTaken(
  email: string,
  excludingUserId: string,
): Promise<boolean> {
  const row = await db.user.findFirst({
    where: { email, id: { not: excludingUserId } },
    select: { id: true },
  });
  return row !== null;
}

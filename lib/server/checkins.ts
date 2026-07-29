/**
 * Check-in state.
 *
 * ⚠️ Still in-memory. Holder ids are the synthetic ones from
 * `lib/checkin/data.ts`, which stand in for issued tickets — there is nothing
 * real to check in against until checkout starts writing `Ticket` rows. The
 * `CheckIn` table exists and keys off `ticketId`; this module moves onto it
 * once tickets are issued, and the synthetic ids retire with it.
 */

const checkins = new Set<string>();

/** All currently checked-in holder ids. */
export async function listCheckedHolderIds(): Promise<string[]> {
  return [...checkins];
}

/** Record or clear a check-in for a holder. */
export async function setCheckin(
  holderId: string,
  checked: boolean,
): Promise<void> {
  if (checked) checkins.add(holderId);
  else checkins.delete(holderId);
}

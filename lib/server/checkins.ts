/**
 * Check-in state over the in-memory {@link checkins} set. Holder ids are the
 * deterministic ids from `lib/checkin/data.ts`, so recorded check-ins survive
 * a page refresh.
 */

import { checkins } from "./store";

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

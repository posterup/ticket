/**
 * Check-in state over the in-memory {@link checkins} set. Holder ids are the
 * deterministic ids from `lib/checkin/data.ts`, so recorded check-ins survive
 * a page refresh.
 */

import { checkins } from "./store";

/** All currently checked-in holder ids. */
export function listCheckedHolderIds(): string[] {
  return [...checkins];
}

/** Record or clear a check-in for a holder. */
export function setCheckin(holderId: string, checked: boolean): void {
  if (checked) checkins.add(holderId);
  else checkins.delete(holderId);
}

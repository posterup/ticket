/**
 * Turning what the door typed or scanned into a ticket holder.
 *
 * Two very different strings arrive at the same box and must be matched
 * differently:
 *
 *  - the **order code**, short and typed by a human under pressure, so case and
 *    surrounding whitespace should not matter;
 *  - the bare **order code**, which is all a buyer offline can read out of
 *    their confirmation SMS — it names an order, not a ticket, so it resolves
 *    to the first seat in that order nobody has been admitted on yet;
 *  - the **`qrToken`**, 43 characters of base64url from a scanner, where case
 *    is *significant* — `a` and `A` are different symbols. Upper-casing it, as
 *    the panel used to do to every input, turns a valid ticket into one that
 *    does not exist.
 *
 * Pure and separate from the component because this is the part that is easy to
 * get wrong and impossible to notice: the failure is a real ticket reported as
 * unknown, at a door, to someone who paid.
 */

export interface HolderRef {
  id: string;
  code: string;
  qrToken: string;
  sessionId: string;
}

export function resolveHolder<T extends HolderRef>(
  holders: readonly T[],
  input: string,
  /**
   * Ticket ids already admitted, so a party arriving on one order can be let
   * through one at a time. Optional: without it the order-code path still
   * resolves, it just always returns the first ticket.
   */
  checked?: ReadonlySet<string>,
): T | undefined {
  const raw = input.trim();
  if (!raw) return undefined;

  // Token first: it is exact and unguessable, so a match is certain. Only then
  // the human-typed code, which is compared case-insensitively.
  const byToken = holders.find((h) => h.qrToken === raw);
  if (byToken) return byToken;

  const upper = raw.toUpperCase();
  const exact = holders.find((h) => h.code.toUpperCase() === upper);
  if (exact) return exact;

  /**
   * The bare **order** code — which is the only one a buyer has at a door.
   *
   * Ticket codes are `${order.code}-${seq}`, and that suffix exists nowhere the
   * buyer can reach without a network: the confirmation SMS says
   * «کد پیگیری: 7XN4F8R6», and the ticket page that would show `-1` is the page
   * that will not load. So the door was told to ask for a code the door then
   * rejected.
   *
   * Matching the order and admitting the first *unchecked* ticket in it is also
   * how a group actually arrives: three people on one order, the code read out
   * three times, three admissions. Once they are all in, the first is returned
   * so the panel can say «قبلاً ثبت شده است» rather than «یافت نشد» — the
   * difference between "you are already inside" and "your ticket is not real".
   */
  const inOrder = holders.filter(
    (h) => h.code.toUpperCase().startsWith(`${upper}-`),
  );
  if (!inOrder.length) return undefined;
  return inOrder.find((h) => !checked?.has(h.id)) ?? inOrder[0];
}

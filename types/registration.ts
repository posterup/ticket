import type { IsoDateTime } from "./api";

/** Where an approval-gated registration stands. */
export type RegistrationStatus = "pending" | "accepted" | "rejected";

/**
 * A request to attend an invite-only event (one whose `requiresApproval` is
 * set). The applicant leaves their full name and phone number and waits; the
 * organiser accepts or rejects from the «درخواست‌های ثبت‌نام» tab. Distinct from
 * an invited {@link EventGuest}: here the attendee asks to join and the host decides.
 */
export interface EventRegistration {
  id: string;
  eventId: string;
  /** Applicant's full name. */
  name: string;
  /** Applicant's phone number. */
  phone: string;
  /** How many tickets the applicant is requesting. */
  tickets: number;
  status: RegistrationStatus;
  createdAt: IsoDateTime;
}

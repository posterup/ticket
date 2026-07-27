import type { IsoDateTime } from "./api";

/** Where an approval-gated registration stands. */
export type RegistrationStatus = "pending" | "accepted" | "rejected";

/**
 * A request to attend an approval-gated event (one whose `requiresApproval` is
 * set). The applicant submits their details and waits; the organiser accepts or
 * rejects from the پذیرش و مهمانان tab. Distinct from an invited {@link EventGuest}:
 * here the attendee asks to join and the host decides.
 */
export interface EventRegistration {
  id: string;
  eventId: string;
  /** Applicant's display name. */
  name: string;
  /** Phone number or email the applicant registered with. */
  contact: string;
  channel: "phone" | "email";
  /** Optional message the applicant left with their request. */
  note?: string;
  status: RegistrationStatus;
  createdAt: IsoDateTime;
}

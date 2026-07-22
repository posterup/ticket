import type { IsoDateTime } from "./api";

/** A CRM segmentation label attached to an attendee. */
export interface AttendeeTag {
  id: string;
  label: string;
  /** Optional UI colour token, e.g. `emerald`, `amber`. */
  color?: string;
}

/**
 * An organiser-defined extra field on a contact record (e.g. company,
 * dietary preference). Values are stored as strings for storage simplicity.
 */
export interface CustomField {
  key: string;
  label: string;
  value: string;
}

/** A CRM contact who may hold tickets across many events. */
export interface Attendee {
  id: string;
  fullName: string;
  /** E.164-ish Iranian mobile number, e.g. `+989121234567`. */
  phone: string;
  tags: AttendeeTag[];
  notes?: string;
  customFields: CustomField[];
  createdAt: IsoDateTime;
}

/** Payload accepted by attendee creation; server fills id and timestamp. */
export interface CreateAttendeeInput {
  fullName: string;
  phone: string;
  tags?: AttendeeTag[];
  notes?: string;
  customFields?: CustomField[];
}

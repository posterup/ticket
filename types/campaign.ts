import type { IsoDateTime } from "./api";

export type CampaignChannel = "sms";
export type CampaignStatus = "draft" | "scheduled" | "sent";

/** A marketing campaign sent to an audience segment over a channel. */
export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  /** Human-readable audience segment label. */
  segment: string;
  status: CampaignStatus;
  recipients: number;
  message: string;
  sentAt?: IsoDateTime;
}

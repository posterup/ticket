import { redirect } from "next/navigation";

/**
 * Ticket-template customization moved into each event's dashboard page (under
 * the «بلیت‌ها» tab). This former standalone route now redirects to events.
 */
export default function CustomizeTicketPage() {
  redirect("/dashboard/events");
}

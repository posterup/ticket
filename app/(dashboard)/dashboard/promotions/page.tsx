import { redirect } from "next/navigation";

/**
 * Discounts moved into each event's dashboard page (scoped per event or per
 * سانس). This former standalone tab now redirects to the events list.
 */
export default function PromotionsPage() {
  redirect("/dashboard/events");
}

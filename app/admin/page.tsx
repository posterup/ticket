import { redirect } from "next/navigation";

/** The panel has one surface today, so the root is a signpost to it. */
export default function AdminIndex() {
  redirect("/admin/venues");
}

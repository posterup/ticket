import type { Metadata } from "next";

import { listWorkspaces } from "@/lib/server";
import { EditProfileForm } from "@/components/dashboard/EditProfileForm";

export const metadata: Metadata = { title: "ویرایش پروفایل | پوستر" };

export default function EditProfilePage() {
  const workspaces = listWorkspaces();
  return <EditProfileForm workspaces={workspaces} />;
}

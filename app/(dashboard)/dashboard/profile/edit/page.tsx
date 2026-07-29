import type { Metadata } from "next";

import { listWorkspaces } from "@/lib/server";
import { EditProfileForm } from "@/components/dashboard/EditProfileForm";

export const metadata: Metadata = { title: "ویرایش پروفایل | پوستر" };

export default async function EditProfilePage() {
  const workspaces = await listWorkspaces();
  return <EditProfileForm workspaces={workspaces} />;
}

import type { Metadata } from "next";

import { listWorkspacesForUser } from "@/lib/server";
import { EditProfileForm } from "@/components/dashboard/EditProfileForm";
import { requireManagerPage } from "@/lib/server/auth/guards";

export const metadata: Metadata = { title: "ویرایش پروفایل | پوستر" };

export default async function EditProfilePage() {
  const { user } = await requireManagerPage();

  // Your own workspaces, not the platform directory.
  const workspaces = await listWorkspacesForUser(user.id);
  return <EditProfileForm workspaces={workspaces} />;
}

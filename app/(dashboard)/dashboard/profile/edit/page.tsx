import type { Metadata } from "next";

import { listWorkspaces } from "@/lib/server";
import { EditProfileForm } from "@/components/dashboard/EditProfileForm";
import { requireManagerPage } from "@/lib/server/auth/guards";

export const metadata: Metadata = { title: "ویرایش پروفایل | پوستر" };

export default async function EditProfilePage() {
  await requireManagerPage();

  const workspaces = await listWorkspaces();
  return <EditProfileForm workspaces={workspaces} />;
}

"use client";

import { EditProfileForm } from "@/components/dashboard/EditProfileForm";
import { useWorkspaceSwitcher } from "@/components/dashboard/ActiveWorkspace";

export default function EditProfilePage() {
  // From the shell, which already loaded the caller's own workspaces.
  const { workspaces } = useWorkspaceSwitcher();
  return <EditProfileForm workspaces={workspaces} />;
}

"use client";

import { EditProfileForm } from "@/components/dashboard/EditProfileForm";

export default function EditProfilePage() {
  // The form reads the active workspace from the shell's context itself.
  return <EditProfileForm />;
}

"use client";

import { ProfileCard } from "@/components/dashboard/ProfileCard";
import { AccountMenu } from "@/components/dashboard/AccountMenu";
import { useWorkspaceSwitcher } from "@/components/dashboard/ActiveWorkspace";

export default function ProfilePage() {
  // From the shell, which already loaded the caller's own workspaces.
  const { workspaces } = useWorkspaceSwitcher();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          پروفایل
        </h1>
        <p className="mt-1 text-sm text-muted">
          حساب، فضای کاری و تنظیمات شما.
        </p>
      </div>

      <ProfileCard workspaces={workspaces} />
      <AccountMenu />
    </div>
  );
}

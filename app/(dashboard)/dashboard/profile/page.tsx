import type { Metadata } from "next";

import { listWorkspaces } from "@/lib/server";
import { ProfileCard } from "@/components/dashboard/ProfileCard";
import { AccountMenu } from "@/components/dashboard/AccountMenu";

export const metadata: Metadata = { title: "پروفایل | پوستر" };

export default function ProfilePage() {
  const workspaces = listWorkspaces();

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

import type { Metadata } from "next";

import { listWorkspacesForUser } from "@/lib/server";
import { ProfileCard } from "@/components/dashboard/ProfileCard";
import { AccountMenu } from "@/components/dashboard/AccountMenu";
import { requireManagerPage } from "@/lib/server/auth/guards";

export const metadata: Metadata = { title: "پروفایل | پوستر" };

export default async function ProfilePage() {
  const { user } = await requireManagerPage();

  // Your own workspaces, not the platform directory.
  const workspaces = await listWorkspacesForUser(user.id);

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

import type { Metadata } from "next";

import { CreateWorkspaceForm } from "@/components/workspace/CreateWorkspaceForm";

export const metadata: Metadata = { title: "فضای کاری جدید | پوستر" };

export default function NewWorkspacePage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          فضای کاری جدید
        </h1>
        <p className="mt-1 text-sm text-muted">
          یک فضای کاری شخصی یا کسب‌وکار برای مدیریت رویدادهای جداگانه بسازید.
        </p>
      </div>
      <CreateWorkspaceForm />
    </div>
  );
}

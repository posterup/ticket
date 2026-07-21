import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";

export const metadata: Metadata = { title: "تغییر رمز عبور | پوستر" };

export default function ChangePasswordPage() {
  return <ChangePasswordForm />;
}

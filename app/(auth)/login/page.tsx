import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "ورود | پوستر" };

export default function LoginPage() {
  return <LoginForm />;
}

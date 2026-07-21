"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { clearLoggedIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  function logout() {
    clearLoggedIn();
    router.push("/");
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" onClick={logout} className="self-start">
      <LogOut className="size-4" aria-hidden />
      خروج از حساب
    </Button>
  );
}

"use client";

import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The single edit affordance used across every dashboard card (محل برگزاری،
 * زمان‌بندی، ثبت‌نام و دسترسی …) so the «ویرایش» control looks identical
 * everywhere. A thin wrapper over the secondary {@link Button}; extra props
 * (onClick, disabled, className) pass straight through.
 */
export function EditButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button type="button" variant="secondary" size="sm" {...props}>
      <Pencil aria-hidden />
      ویرایش
    </Button>
  );
}

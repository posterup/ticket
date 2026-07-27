"use client";

import * as React from "react";
import { Chip } from "@heroui/react";

import { cn } from "@/lib/utils";

export interface BadgeProps {
  /** `accent` → soft pink pill; `neutral` → quiet default pill. */
  variant?: "accent" | "neutral";
  size?: "sm" | "md";
  className?: string;
  children?: React.ReactNode;
}

/** Small status pill — HeroUI <Chip>, themed by the brand tokens. */
function Badge({ className, variant = "accent", size = "md", children }: BadgeProps) {
  return (
    <Chip
      color={variant === "accent" ? "accent" : "default"}
      variant="soft"
      size={size}
      className={cn("rounded-full", className)}
    >
      {children}
    </Chip>
  );
}

export { Badge };

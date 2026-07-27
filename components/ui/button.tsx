"use client";

import * as React from "react";
import { Button as HeroButton } from "@heroui/react";

import { cn } from "@/lib/utils";
import {
  buttonVariants,
  type ButtonVariantProps,
} from "@/components/ui/button-variants";

/*
  Button primitive — backed by HeroUI's accessible <Button> (React Aria),
  themed to the Poster neon brand via the shared tokens in globals.css. The
  public API is unchanged (native `onClick`/`disabled`/`type` + our variant/size
  names) so every existing call site keeps working; internally we translate to
  HeroUI's props.
*/

/** Our variant names → HeroUI's. `secondary` maps to HeroUI's bordered look. */
const HERO_VARIANT = {
  primary: "primary",
  secondary: "outline",
  ghost: "ghost",
} as const;

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    ButtonVariantProps {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      type = "button",
      disabled,
      onClick,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <HeroButton
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type}
        variant={HERO_VARIANT[variant ?? "primary"]}
        size={size ?? "md"}
        isDisabled={disabled}
        // Call sites use native onClick; HeroUI's React-Aria button fires
        // onPress. Most handlers ignore the event, so forwarding is safe.
        onPress={
          onClick ? (e) => (onClick as (e: unknown) => void)(e) : undefined
        }
        className={cn(className)}
        // External API is native button attrs; the only mismatch with HeroUI's
        // React-Aria props is the event-handler element generic — safe to cast.
        {...(props as unknown as Record<string, never>)}
      >
        {children}
      </HeroButton>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

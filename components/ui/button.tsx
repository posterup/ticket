import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
  Button primitive in the shadcn/ui spirit, tuned to the Gishe design language:
  soft radius, tactile press, calm accent. Intentionally not the default shadcn skin.
*/
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[transform,background-color,box-shadow,color] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-foreground shadow-sm hover:brightness-110 active:translate-y-px active:brightness-95",
        secondary:
          "bg-card text-foreground border border-border shadow-sm hover:bg-subtle active:translate-y-px",
        ghost: "text-foreground hover:bg-subtle active:translate-y-px",
      },
      size: {
        sm: "h-9 px-4 [&_svg]:size-4",
        md: "h-11 px-5 [&_svg]:size-[1.15rem]",
        lg: "h-13 px-7 text-base [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

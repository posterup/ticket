import { cva, type VariantProps } from "class-variance-authority";

/*
  Button class recipe, kept in a server-safe module (no "use client") so Server
  Components can style a non-button element — a Next <Link>, an <a> — to match
  the HeroUI <Button>. The interactive <Button> itself lives in ./button and is
  backed by HeroUI. Both read the same neon brand tokens, so they look alike.
*/
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[transform,background-color,box-shadow,color] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-foreground shadow-[0_0_24px_-4px_var(--accent)] hover:brightness-110 hover:shadow-[0_0_32px_-2px_var(--accent)] active:translate-y-px",
        secondary:
          "bg-card text-foreground border border-border shadow-sm hover:border-accent hover:shadow-[0_0_18px_-6px_var(--accent)] active:translate-y-px",
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

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

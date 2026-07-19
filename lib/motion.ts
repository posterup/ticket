import type { Variants } from "framer-motion";

/** Premium easing curve used across entrance animations. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Parent container that reveals its children in a gentle sequence. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.05,
    },
  },
};

/** Individual "fade up" item, driven by the parent's stagger. */
export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT },
  },
};

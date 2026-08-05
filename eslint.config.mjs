import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/**
 * Flat config, because `next lint` is removed in Next 16 and its interactive
 * setup prompt makes `npm run lint` unrunnable in CI.
 *
 * `eslint-config-next` is still shipped as eslintrc-shaped, so it comes in
 * through FlatCompat.
 */
const config = [
  {
    ignores: [".next/**", "generated/**", "node_modules/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;

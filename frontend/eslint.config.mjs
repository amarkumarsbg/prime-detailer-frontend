import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "**/src/app/(dashboard)/booking/create-booking-page.tsx",
      "**/src/features/booking-wizard/components/create-booking-page.tsx",
    ],
    rules: {
      // Large wizard: many intentional effect-driven resets; refactoring would be high-risk for little gain.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "backend/**",
  ]),
]);

export default eslintConfig;

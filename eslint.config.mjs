import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs", "tests/integration/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        fetch: "readonly",
      },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [ts.configs.recommended, hooks.configs.flat.recommended],
  },
  prettier,
  globalIgnores([
    ".agents/**",
    ".impeccable/**",
    ".next/**",
    "out/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    ".database-tests/**",
  ]),
]);

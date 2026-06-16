import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Prevent unsafe type assertions
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",

      // Catch unused variables (allow underscore prefix)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Allow empty catch blocks (we handle this in conventions)
      "@typescript-eslint/no-empty-function": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],

      // Require consistent returns
      "no-unreachable": "error",
      "no-constant-condition": "warn",
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
  {
    // Data-access seam guard: API services must go through the repository layer
    // (apps/api/src/repositories), not raw Drizzle. You cannot write a raw query
    // without importing the schema tables, so forbidding that import here is the
    // precise signal. `db.transaction` (from ../db/index) stays allowed so
    // services can still own transaction boundaries.
    // Exemption: diagnostics.service.ts — read-only health/diagnostics SQL +
    // pingDatabase, which legitimately needs low-level db access.
    files: ["apps/api/src/services/**/*.ts"],
    ignores: ["apps/api/src/services/diagnostics.service.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/db/schema", "**/db/schema.js"],
              message:
                "API services must access data through repositories (apps/api/src/repositories), not raw Drizzle queries. Add or extend a repository instead of importing schema tables here.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.vercel/**"],
  },
);

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
    ignores: ["**/dist/**", "**/node_modules/**", "**/.vercel/**"],
  },
);

import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  { ignores: ["**/dist/**", "node_modules/**", "**/.next/**", "**/next-env.d.ts"] },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        AbortSignal: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
      },
    },
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  { rules: { "@typescript-eslint/no-explicit-any": "error" } },
);

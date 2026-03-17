import js from "@eslint/js";
import eslintConfigFlatGitignore from "eslint-config-flat-gitignore";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginJest from "eslint-plugin-jest";
import typescriptEslint from "typescript-eslint";

export default typescriptEslint.config(
  eslintConfigFlatGitignore(),
  {
    ignores: [
      "dist/",
      "coverage/",
      "node_modules/",
      "rust/",
      "site/",
      "website/",
      "live/",
      "packages/",
      "mcp-server/",
      "channel-bot/",
      "websocket-server/",
      "telegram-bot/",
      "x402/",
      "**/*.json",
    ],
  },
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["src/__tests__/**/*.ts"],
    ...eslintPluginJest.configs["flat/recommended"],
  },
  eslintConfigPrettier,
);

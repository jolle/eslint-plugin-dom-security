import domSecurity from "eslint-plugin-dom-security";
import typescriptParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "dom-security": domSecurity,
    },
    rules: {
      "dom-security/no-unsafe-redirect": "error",
    },
  },
  {
    files: ["**/*.js", "**/*.jsx"],
    plugins: {
      "dom-security": domSecurity,
    },
    rules: {
      "dom-security/no-unsafe-redirect": "error",
    },
  },
];

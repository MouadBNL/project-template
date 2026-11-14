import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

RuleTester.describe = describe;
RuleTester.it = it;

/** Shared RuleTester wired to Vitest. Parses as TSX modules unless a test sets `filename`. */
export const ruleTester = new RuleTester({
  languageOptions: { sourceType: "module", parserOptions: { lang: "tsx" } },
});

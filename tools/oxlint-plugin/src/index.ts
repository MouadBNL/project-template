import type { Plugin } from "vite-plus/lint/plugins";
import { boundaries } from "./boundaries.ts";
import { designTokens } from "./design-tokens.ts";
import { effectFile } from "./effect-file.ts";
import { noEffect } from "./no-effect.ts";
import { noManualMemo } from "./no-manual-memo.ts";
import { noProcessEnv } from "./no-process-env.ts";
import { noThrow } from "./no-throw.ts";
import { pureModel } from "./pure-model.ts";
import { testHygiene } from "./test-hygiene.ts";

/** Rules are referenced as `repo/<name>` in the root vite.config.ts. */
const plugin: Plugin = {
  meta: { name: "repo" },
  rules: {
    boundaries,
    "design-tokens": designTokens,
    "effect-file": effectFile,
    "no-effect": noEffect,
    "no-manual-memo": noManualMemo,
    "no-process-env": noProcessEnv,
    "no-throw": noThrow,
    "pure-model": pureModel,
    "test-hygiene": testHygiene,
  },
};

// oxlint loads JS plugins through their default export.
export default plugin;

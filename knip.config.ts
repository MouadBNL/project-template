/**
 * Dead code (https://knip.dev). The `knip` task in the root vite.config.ts runs it twice:
 *
 * - `knip`: unused files, dependencies, catalog entries and exports, counting tests as users.
 *   Workspace packages also report unused exports of their entry files (`includeEntryExports`):
 *   nothing outside this repo imports them, so an export no workspace uses is dead.
 * - `knip --production`: only what ships. Project files marked with `!` are production code;
 *   tests, test helpers and fixtures are left out, so an export (or a file) that only tests use
 *   is reported. An export used inside its own file is not dead (`ignoreExportsUsedInFile`); one
 *   that exists for test code elsewhere says so with a `@internal` JSDoc tag.
 */
import type { KnipConfig } from "knip";

/** Code only tests run, excluded from the production analysis. */
const TEST_ONLY = [
  "!src/**/*.test.{ts,tsx}!",
  "!src/testing/**!",
  "!src/testing.ts!",
  "!src/test-setup.ts!",
  "!src/fixtures.ts!",
  "!src/**/*-fixtures.ts!",
];

const config: KnipConfig = {
  ignoreExportsUsedInFile: true,
  ignoreIssues: {
    // A type exported from a package's entry is part of the signatures it exports (`ButtonProps`
    // for `Button`, docs/react.md), so it stays even when no one names it.
    "packages/*/src/index.ts": ["types"],
    "packages/ui/src/*.tsx": ["types"],
  },
  workspaces: {
    "apps/api": { project: ["src/**/*.ts!", ...TEST_ONLY] },
    "apps/web": { project: ["src/**/*.{ts,tsx,css}!", ...TEST_ONLY] },
    "packages/*": { includeEntryExports: true, project: ["src/**/*.{ts,tsx}!", ...TEST_ONLY] },
    "tools/oxlint-plugin": { project: ["src/**/*.ts!", ...TEST_ONLY, "!src/rule-tester.ts!"] },
    "tools/canary": { project: ["src/**/*.ts!", ...TEST_ONLY] },
    "tools/rename-scope": { project: ["src/**/*.ts!", ...TEST_ONLY] },
    "tools/workspace-check": { project: ["src/**/*.ts!", ...TEST_ONLY] },
    // The Playwright suite is test code throughout: no `!`, so production mode skips it.
    e2e: { project: ["src/**/*.ts", "tests/**/*.ts"] },
  },
};

export default config;

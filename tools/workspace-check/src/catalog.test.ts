/**
 * Versions live only in `pnpm-workspace.yaml#catalog`. pnpm's `catalogMode: strict` applies to
 * `pnpm add` only: a version typed into a package.json by hand installs without a word, inside
 * the catalog's range or not. So this test reads every package.json of the repo and fails on any
 * dependency that is not `catalog:` (a version from the catalog) or `workspace:*` (a package of
 * this repo).
 */
import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import * as z from "zod";

const REPO = path.resolve(import.meta.dirname, "../../..");

/** Folders that hold no package.json of ours. */
const SKIPPED = new Set(["node_modules", ".git", ".data", "dist", "test-results"]);

const FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

const ALLOWED = new Set(["catalog:", "workspace:*"]);

const Specifiers = z.record(z.string(), z.string()).optional();
const Manifest = z.object({
  dependencies: Specifiers,
  devDependencies: Specifiers,
  optionalDependencies: Specifiers,
  peerDependencies: Specifiers,
});

/** Every dependency `manifest` (at `file`) pins in place instead of taking from the catalog. */
function versionsOutsideCatalog(file: string, manifest: z.infer<typeof Manifest>): string[] {
  return FIELDS.flatMap((field) =>
    Object.entries(manifest[field] ?? {})
      .filter(([, specifier]) => !ALLOWED.has(specifier))
      .map(
        ([name, specifier]) =>
          `${file}: ${field}.${name} is "${specifier}". Declare the version once in pnpm-workspace.yaml#catalog and write "catalog:" here ("workspace:*" for a package of this repo), then run vp install.`,
      ),
  );
}

/** Repo-relative paths of every package.json outside node_modules and build output. */
function manifestPaths(): string[] {
  return globSync("**/package.json", {
    cwd: REPO,
    exclude: (entry) => SKIPPED.has(path.basename(entry)),
  }).toSorted();
}

const read = (file: string) =>
  Manifest.parse(JSON.parse(readFileSync(path.join(REPO, file), "utf8")));

describe("versionsOutsideCatalog", () => {
  it("accepts the catalog and the workspace", () => {
    const manifest = { dependencies: { zod: "catalog:" }, devDependencies: { x: "workspace:*" } };
    expect(versionsOutsideCatalog("p/package.json", manifest)).toEqual([]);
  });

  it("names every version written in place, in any dependency field", () => {
    const manifest = { dependencies: { zod: "^4.0.0" }, peerDependencies: { react: "19.3.1" } };
    expect(versionsOutsideCatalog("p/package.json", manifest)).toEqual([
      expect.stringMatching(/^p\/package\.json: dependencies\.zod is "\^4\.0\.0"\. Declare/),
      expect.stringMatching(/^p\/package\.json: peerDependencies\.react is "19\.3\.1"\. Declare/),
    ]);
  });
});

describe("the repo", () => {
  it("finds the root, the apps, the packages and the tools", () => {
    expect(manifestPaths()).toEqual(
      expect.arrayContaining([
        "package.json",
        "apps/api/package.json",
        "apps/web/package.json",
        "packages/result/package.json",
        "tools/workspace-check/package.json",
        "e2e/package.json",
      ]),
    );
  });

  it("takes every dependency version from the catalog or the workspace", () => {
    expect(manifestPaths().flatMap((file) => versionsOutsideCatalog(file, read(file)))).toEqual([]);
  });
});

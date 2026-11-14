import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { err, ok } from "@app/result";
import { renameScope } from "./rename-scope.ts";

/** A small repository: a root, two scoped packages, docs, an installed copy and a binary file. */
const FIXTURE: Readonly<Record<string, string>> = {
  "package.json": '{\n  "name": "template",\n  "private": true\n}\n',
  "packages/core/package.json": '{ "name": "@fixture/core" }\n',
  "apps/web/package.json":
    '{ "name": "@fixture/web", "dependencies": { "@fixture/core": "workspace:*" } }\n',
  "apps/web/src/main.ts": 'import { core } from "@fixture/core";\nexport const web = core;\n',
  "docs/start.md": "Import `@fixture/core`; ask user@fixture/help.\n",
  "notes.txt": "No scope here.\n",
  "node_modules/@fixture/core/package.json": '{ "name": "@fixture/core" }\n',
};
const BINARY = Buffer.from([0x89, 0x00, ...Buffer.from("@fixture/core")]);

let root: string;
let formatted: (readonly string[])[];

/** Stands in for `vp fmt`, which needs an installed repository: records what it was given. */
const format = async (_root: string, files: readonly string[]) => {
  formatted.push(files);
  return ok();
};

/** A formatter that fails, as `vp fmt` does when the repository is not installed. */
const failing = async () => err({ type: "format_failed", cause: "no vp" });

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "rename-scope-"));
  formatted = [];
  for (const [file, text] of Object.entries(FIXTURE)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), text);
  }
  await writeFile(path.join(root, "logo.png"), BINARY);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const read = (file: string): Promise<string> => readFile(path.join(root, file), "utf8");

describe("renameScope", () => {
  it("renames the scope in every text file that names it, and the root package", async () => {
    const renamed = await renameScope(root, "acme", format);

    expect(renamed).toEqual({
      ok: true,
      value: {
        from: "fixture",
        to: "acme",
        files: [
          "apps/web/package.json",
          "apps/web/src/main.ts",
          "docs/start.md",
          "package.json",
          "packages/core/package.json",
        ],
      },
    });
    expect(await read("package.json")).toBe('{\n  "name": "acme",\n  "private": true\n}\n');
    expect(await read("apps/web/package.json")).toBe(
      '{ "name": "@acme/web", "dependencies": { "@acme/core": "workspace:*" } }\n',
    );
    expect(await read("apps/web/src/main.ts")).toBe(
      'import { core } from "@acme/core";\nexport const web = core;\n',
    );
    expect(await read("docs/start.md")).toBe("Import `@acme/core`; ask user@fixture/help.\n");
    expect(formatted).toEqual([
      [
        "apps/web/package.json",
        "apps/web/src/main.ts",
        "docs/start.md",
        "package.json",
        "packages/core/package.json",
      ],
    ]);
  });

  it("reports a formatter that fails, after the rename is written", async () => {
    expect(await renameScope(root, "acme", failing)).toEqual({
      ok: false,
      error: { type: "format_failed", cause: "no vp" },
    });
    expect(await read("package.json")).toBe('{\n  "name": "acme",\n  "private": true\n}\n');
  });

  it("leaves installed packages and binary files alone", async () => {
    await renameScope(root, "acme", format);
    expect(await read("node_modules/@fixture/core/package.json")).toBe(
      '{ "name": "@fixture/core" }\n',
    );
    expect(await readFile(path.join(root, "logo.png"))).toEqual(BINARY);
  });

  it("writes nothing when the name is invalid or already the scope", async () => {
    expect(await renameScope(root, "Acme Labs", format)).toEqual({
      ok: false,
      error: { type: "invalid_name", name: "Acme Labs" },
    });
    expect(await renameScope(root, "@fixture", format)).toEqual({
      ok: false,
      error: { type: "same_scope", scope: "fixture" },
    });
    expect(await read("package.json")).toBe(FIXTURE["package.json"]);
    expect(formatted).toEqual([]);
  });

  it("reports a tree it cannot read as a value", async () => {
    const missing = path.join(root, "missing");
    expect(await renameScope(missing, "acme", format)).toMatchObject({
      ok: false,
      error: { type: "io_failed", path: missing },
    });
  });
});

import { fires, lines, passes, type Case, type Sample } from "../case.ts";

const AT = "apps/api/src/modules/canary-types";

/** A sample at `AT/<name>.ts` that reports exactly `rules`. */
const typed = (name: string, code: string[], ...rules: [string, ...string[]]): Sample =>
  fires(`${AT}/${name}.ts`, lines(...code), ...rules);

const RULES = "lint.rules (type-aware: `options.typeAware`)";

export const TYPE_CASES: readonly Case[] = [
  {
    convention: "no any, and no unsafe use of an any",
    config: RULES,
    samples: [
      typed("explicit-any", ["export const loose: any = 1;"], "typescript/no-explicit-any"),
      typed(
        "unsafe-assignment",
        [
          "export function read(text: string): void {",
          "  const value = JSON.parse(text);",
          "  String(value);",
          "}",
        ],
        "typescript/no-unsafe-assignment",
      ),
      typed(
        "unsafe-argument",
        [
          "const twice = (n: number): number => n * 2;",
          "export const read = (text: string): number => twice(JSON.parse(text));",
        ],
        "typescript/no-unsafe-argument",
      ),
      typed(
        "unsafe-call",
        ["export function run(text: string): void {", "  JSON.parse(text)();", "}"],
        "typescript/no-unsafe-call",
      ),
      typed(
        "unsafe-member-access",
        ["export const field = (text: string): unknown => JSON.parse(text).field;"],
        "typescript/no-unsafe-member-access",
      ),
      typed(
        "unsafe-return",
        ["export function count(text: string): number {", "  return JSON.parse(text);", "}"],
        "typescript/no-unsafe-return",
      ),
    ],
  },
  {
    convention: "no as casts (as const excepted), no non-null !, no needless assertion",
    config: RULES,
    samples: [
      typed(
        "cast",
        ['export const wide = "a" as string;'],
        "typescript/consistent-type-assertions",
      ),
      typed(
        "needless-cast",
        ["export const same = (text: string): string => text as string;"],
        "typescript/consistent-type-assertions",
        "typescript/no-unnecessary-type-assertion",
      ),
      typed(
        "non-null",
        ['export const first = (map: Map<string, number>): number => map.get("a")!;'],
        "typescript/no-non-null-assertion",
      ),
      passes(`${AT}/as-const.ts`, lines('export const MODES = ["light", "dark"] as const;')),
    ],
  },
  {
    convention: "no floating or misused promises, no await of a non-promise",
    config: RULES,
    samples: [
      typed(
        "floating",
        [
          "const save = async (): Promise<void> => undefined;",
          "export function onSave(): void {",
          "  save();",
          "}",
        ],
        "typescript/no-floating-promises",
      ),
      typed(
        "misused",
        [
          "const save = async (): Promise<void> => undefined;",
          "export function saveAll(ids: readonly number[]): void {",
          "  ids.forEach(async () => {",
          "    await save();",
          "  });",
          "}",
        ],
        "typescript/no-misused-promises",
      ),
      typed(
        "await-value",
        ["export async function one(): Promise<number> {", "  return await 1;", "}"],
        "typescript/await-thenable",
        "unicorn/no-unnecessary-await",
      ),
    ],
  },
  {
    convention: "the type checker's own strictness: no needless condition, safe templates",
    config: RULES,
    samples: [
      typed(
        "needless-condition",
        ['export const orDefault = (text: string): string => text ?? "none";'],
        "typescript/no-unnecessary-condition",
      ),
      typed(
        "template",
        [
          "export const show = (ids: readonly number[]): string => `ids: ${String(ids.length)} ${ids}`;",
        ],
        "typescript/restrict-template-expressions",
      ),
      typed(
        "type-import",
        [
          'import { Hono } from "hono";',
          "export const routes = (app: Hono): number => app.routes.length;",
        ],
        "typescript/consistent-type-imports",
      ),
    ],
  },
  {
    convention: "TypeScript errors fail the lint; @ts-expect-error only with a description",
    config: "`options.typeCheck` and `typescript/ban-ts-comment` in lint.rules",
    samples: [
      typed("type-error", ['export const count: number = "three";'], "type-check"),
      typed(
        "ts-ignore",
        ["export function one(): number {", "  // @ts-ignore", "  return 1;", "}"],
        "typescript/ban-ts-comment",
      ),
      typed("ts-nocheck", ["// @ts-nocheck", "export const one = 1;"], "typescript/ban-ts-comment"),
      passes(
        `${AT}/expected-error.ts`,
        lines(
          "// @ts-expect-error -- a string where a number is due, which is what this sample shows",
          'export const count: number = "three";',
        ),
      ),
    ],
  },
  {
    convention: "no disable comment that disables nothing",
    config: "`options.reportUnusedDisableDirectives`",
    samples: [
      typed(
        "unused-directive",
        ["// oxlint-disable-next-line no-debugger", "export const one = 1;"],
        "unused-disable-directive",
      ),
    ],
  },
];

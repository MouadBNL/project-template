import { fires, lines, passes, sized, type Case, type Sample } from "../case.ts";

type Limits = { readonly file: number; readonly fn: number; readonly complexity: number };

/** The limits vite.config.ts sets, written out again: raising one there fails the canary. */
const SIZE: Limits = { file: 400, fn: 200, complexity: 45 };
const WEB_SIZE: Limits = { file: 250, fn: 120, complexity: 25 };
const BACKEND_SIZE: Limits = { file: 300, fn: 65, complexity: 15 };
const TEST_SIZE: Limits = { file: 700, fn: 300, complexity: 30 };
const ROUTE_SIZE: Limits = { file: 150, fn: 40, complexity: 5 };

/** The edge of each limit: at it passes, one past it fails. `base` is a path without extension. */
function edges(
  base: string,
  ext: string,
  { file, fn, complexity }: Limits,
  all: boolean,
): Sample[] {
  const samples = [
    passes(`${base}-at-limit${ext}`, sized({ file, fn, complexity })),
    fires(`${base}-long${ext}`, sized({ file: file + 1 }), "max-lines"),
  ];
  if (!all) return samples;
  const complex = complexity + 4;
  return [
    ...samples,
    fires(
      `${base}-long-function${ext}`,
      sized({ file: fn + 1, fn: fn + 1 }),
      "max-lines-per-function",
    ),
    fires(
      `${base}-complex${ext}`,
      sized({ file: complex, fn: complex, complexity: complexity + 1 }),
      "complexity",
    ),
  ];
}

const area = (where: string, limits: Limits, config: string, samples: Sample[]): Case => ({
  convention: `${where}: at most ${String(limits.file)} lines a file, ${String(limits.fn)} a function, complexity ${String(limits.complexity)}`,
  config: `${config} (max-lines, max-lines-per-function, complexity)`,
  samples,
});

export const SIZE_CASES: readonly Case[] = [
  area(
    "code outside the areas below",
    SIZE,
    "SIZE in lint.rules",
    edges("canary-sized", ".ts", SIZE, true),
  ),
  area("the web app and packages/ui", WEB_SIZE, "the WEB_SIZE override", [
    ...edges("apps/web/src/lib/canary-sized", ".ts", WEB_SIZE, true),
    ...edges("packages/ui/src/canary-sized", ".ts", WEB_SIZE, false),
  ]),
  area("the API, the packages but ui, and the tools", BACKEND_SIZE, "the BACKEND_SIZE override", [
    ...edges("apps/api/src/modules/canary-sized/sized", ".ts", BACKEND_SIZE, true),
    ...edges("packages/db/src/canary-sized", ".ts", BACKEND_SIZE, false),
    ...edges("tools/oxlint-plugin/src/canary-sized", ".ts", BACKEND_SIZE, false),
  ]),
  area("tests and test-only code (after the area overrides)", TEST_SIZE, "the TEST_CODE override", [
    ...edges("apps/web/src/features/canary-sized/sized", ".test.ts", TEST_SIZE, true),
    ...edges("e2e/src/canary-sized", ".ts", TEST_SIZE, false),
  ]),
  area(
    "route files",
    ROUTE_SIZE,
    "the routes override",
    edges("apps/web/src/routes/canary-sized", ".tsx", ROUTE_SIZE, true),
  ),
  {
    convention: "nesting depth: at most 4 blocks",
    config: "`max-depth` in lint.rules",
    samples: [
      fires(
        "apps/api/src/modules/canary-sized/deep.ts",
        lines(
          "export function deep(n: number): number {",
          "  if (n > 1) {",
          "    if (n > 2) {",
          "      if (n > 3) {",
          "        if (n > 4) {",
          "          if (n > 5) {",
          "            return 5;",
          "          }",
          "        }",
          "      }",
          "    }",
          "  }",
          "  return 0;",
          "}",
        ),
        "max-depth",
      ),
    ],
  },
];

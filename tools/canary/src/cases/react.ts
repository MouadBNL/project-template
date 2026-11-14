import { fires, lines, passes, type Case } from "../case.ts";

const FEATURE = "apps/web/src/features/canary-react";
const VIEW = `${FEATURE}/components`;

/** A component `name` whose body is `body`, rendering `{shown}`. */
const component = (name: string, props: string, body: string[], shown: string): string[] => [
  `export function ${name}(${props}) {`,
  ...body.map((line) => `  ${line}`),
  `  return <p>{${shown}}</p>;`,
  "}",
];

export const REACT_CASES: readonly Case[] = [
  {
    convention: "no useMemo, useCallback or memo: the React Compiler memoizes",
    config: "`repo/no-manual-memo` in the REACT_CODE override",
    samples: [
      fires(
        `${VIEW}/doubled.tsx`,
        lines(
          'import { useMemo } from "react";',
          ...component(
            "Doubled",
            "{ n }: { n: number }",
            ["const x = useMemo(() => n * 2, [n]);"],
            "x",
          ),
        ),
        "repo/no-manual-memo",
      ),
      fires(
        "packages/ui/src/canary-memo.tsx",
        lines(
          'import { memo } from "react";',
          "export const Label = memo(function Label({ text }: { text: string }) {",
          "  return <p>{text}</p>;",
          "});",
        ),
        "repo/no-manual-memo",
      ),
    ],
  },
  {
    convention: "styles use design tokens: no Tailwind palette, no hard-coded colour or length",
    config: "`repo/design-tokens` in the REACT_CODE override",
    samples: [
      fires(
        `${VIEW}/alert.tsx`,
        lines(
          "export function Alert() {",
          '  return <p className="bg-red-500 h-[13px]" style={{ color: "#fff" }}>Alert</p>;',
          "}",
        ),
        "repo/design-tokens",
      ),
      fires(
        "packages/ui/src/canary-badge.tsx",
        lines(
          'import { tv } from "tailwind-variants";',
          'const badge = tv({ base: "rounded-md bg-blue-500" });',
          "export function Badge() {",
          "  return <span className={badge()}>New</span>;",
          "}",
        ),
        "repo/design-tokens",
      ),
      passes(
        `${VIEW}/notice.tsx`,
        lines(
          "export function Notice() {",
          '  return <p className="h-8 rounded-md bg-surface px-3 text-sm text-danger">Notice</p>;',
          "}",
        ),
      ),
    ],
  },
  {
    convention: "only a feature's api/ folder and src/lib talk to the network",
    config: "`no-restricted-globals` in the override that excludes WEB_DATA_ACCESS",
    samples: [
      fires(
        `${VIEW}/loader.tsx`,
        lines(
          "export async function load(): Promise<Response> {",
          '  return fetch("/rpc/things");',
          "}",
        ),
        "no-restricted-globals",
      ),
      passes(
        `${FEATURE}/api/things.ts`,
        lines('export const loadThings = async (): Promise<Response> => fetch("/rpc/things");'),
      ),
      passes(
        "apps/web/src/lib/canary-transport.ts",
        lines('export const send = async (): Promise<Response> => fetch("/rpc/ping");'),
      ),
    ],
  },
  {
    convention: "only api/ and src/lib import the oRPC client (src/lib/orpc.ts)",
    config:
      "the `apps/web/src/lib/orpc.ts` zone of `repo/boundaries` (with `except: WEB_DATA_ACCESS`)",
    samples: [
      fires(
        `${VIEW}/ping-button.tsx`,
        lines(
          'import { api } from "../../../lib/orpc.ts";',
          "export function PingButton() {",
          '  return <button type="button" onClick={() => void api.ping()}>Ping</button>;',
          "}",
        ),
        "repo/boundaries",
      ),
      passes(
        `${FEATURE}/api/ping.ts`,
        lines('import { api } from "../../../lib/orpc.ts";', "export const ping = api.ping;"),
      ),
      passes(
        "apps/web/src/lib/orpc.ts",
        lines('export const api = { ping: async (): Promise<string> => "pong" };'),
      ),
    ],
  },
  {
    convention: "model/ is pure: no clock, random source or browser global (pure packages too)",
    config: "`repo/pure-model` in the model/ override and in the PURE_PACKAGES override",
    samples: [
      fires(
        `${FEATURE}/model/stamp.ts`,
        lines(
          "export const stamp = (): Date => new Date();",
          "export const coin = (): boolean => Math.random() > 0.5;",
          "export const width = (): number => window.innerWidth;",
        ),
        "repo/pure-model",
      ),
      fires(
        "packages/result/src/canary-clock.ts",
        lines("export const now = (): number => Date.now();"),
        "repo/pure-model",
      ),
      fires(
        "packages/contracts/src/canary-clock.ts",
        lines("export const now = (): number => Date.now();"),
        "repo/pure-model",
      ),
      passes(
        `${FEATURE}/model/later.ts`,
        lines(
          'import * as z from "zod";',
          "export const Name = z.string().min(1);",
          "export const later = (now: Date): Date => new Date(now.getTime() + 1000);",
        ),
      ),
    ],
  },
  {
    convention: "a .tsx file exports components only (route files excepted)",
    config: "the `react/only-export-components` override (it must enable the react plugin itself)",
    samples: [
      fires(
        `${VIEW}/counter.tsx`,
        lines(
          "export function Counter() {",
          "  return <p>0</p>;",
          "}",
          "export const step = (n: number): number => n + 1;",
        ),
        "react/only-export-components",
      ),
      passes(
        "apps/web/src/routes/canary-page.tsx",
        lines(
          "function Page() {",
          "  return <p>Page</p>;",
          "}",
          'export const Route = { path: "/canary", component: Page };',
        ),
      ),
    ],
  },
];

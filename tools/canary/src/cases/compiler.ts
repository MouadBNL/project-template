import { fires, lines, type Case } from "../case.ts";

const VIEW = "apps/web/src/features/canary-compiler/components";

export const COMPILER_CASES: readonly Case[] = [
  {
    convention: "rules of hooks: hooks are called unconditionally, in the same order",
    config: "`react/rules-of-hooks` and `react/hooks` in the REACT_CODE override",
    samples: [
      fires(
        `${VIEW}/maybe-count.tsx`,
        lines(
          'import { useState } from "react";',
          "export function MaybeCount({ on }: { on: boolean }) {",
          "  if (on) {",
          "    const [count] = useState(0);",
          "    return <p>{count}</p>;",
          "  }",
          "  return null;",
          "}",
        ),
        "react/rules-of-hooks",
        "react/hooks",
      ),
      fires(
        "packages/ui/src/canary-hooks.tsx",
        lines(
          'import { useId } from "react";',
          "export function Field({ named }: { named: boolean }) {",
          "  const id = named ? useId() : undefined;",
          "  return <p id={id}>Field</p>;",
          "}",
        ),
        "react/rules-of-hooks",
        "react/hooks",
      ),
    ],
  },
  {
    convention: "render is pure: no impure call, global write, ref read, setState or mutation",
    config:
      "`react/purity`, `react/globals`, `react/refs`, `react/set-state-in-render`, `react/immutability` in the REACT_CODE override",
    samples: [
      fires(
        `${VIEW}/lucky.tsx`,
        lines("export function Lucky() {", "  return <p>{Math.random()}</p>;", "}"),
        "react/purity",
      ),
      fires(
        `${VIEW}/visits.tsx`,
        lines(
          "let visits = 0;",
          "export function Visits() {",
          "  visits = visits + 1;",
          "  return <p>{visits}</p>;",
          "}",
        ),
        "react/globals",
      ),
      fires(
        `${VIEW}/peek.tsx`,
        lines(
          'import { useRef } from "react";',
          "export function Peek() {",
          "  const seen = useRef(0);",
          "  return <p>{seen.current}</p>;",
          "}",
        ),
        "react/refs",
      ),
      fires(
        `${VIEW}/loop.tsx`,
        lines(
          'import { useState } from "react";',
          "export function Loop() {",
          "  const [n, setN] = useState(0);",
          "  setN(n + 1);",
          "  return <p>{n}</p>;",
          "}",
        ),
        "react/set-state-in-render",
      ),
      fires(
        `${VIEW}/box.tsx`,
        lines(
          'import { useState } from "react";',
          "export function Box() {",
          "  const [box] = useState({ n: 1 });",
          "  box.n = 2;",
          "  return <p>{box.n}</p>;",
          "}",
        ),
        "react/immutability",
      ),
    ],
  },
  {
    convention: "components are static: none is defined during render",
    config: "`react/static-components` in the REACT_CODE override",
    samples: [
      fires(
        `${VIEW}/outer.tsx`,
        lines(
          "export function Outer({ label }: { label: string }) {",
          "  function Inner() {",
          "    return <p>{label}</p>;",
          "  }",
          "  return <Inner />;",
          "}",
        ),
        "react/static-components",
        "react/no-unstable-nested-components",
      ),
    ],
  },
  {
    convention: "nothing makes the React Compiler bail out of a component",
    config:
      "`react/error-boundaries`, `react/unsupported-syntax`, `react/todo`, `react/rule-suppression`, `react/use-memo`, `react/memo-dependencies` and `react/incompatible-library` in the REACT_CODE override",
    samples: [
      fires(
        `${VIEW}/guarded.tsx`,
        lines(
          "export function Guarded() {",
          "  try {",
          "    return <p>Guarded</p>;",
          "  } catch {",
          "    return null;",
          "  }",
          "}",
        ),
        "react/error-boundaries",
        "repo/no-throw",
      ),
      fires(
        `${VIEW}/evaluated.tsx`,
        lines("export function Evaluated() {", '  return <p>{String(eval("1"))}</p>;', "}"),
        "react/unsupported-syntax",
        "no-eval",
      ),
      fires(
        `${VIEW}/getter.tsx`,
        lines(
          "export function Getter({ n }: { n: number }) {",
          "  const box = {",
          "    get value() {",
          "      return n;",
          "    },",
          "  };",
          "  return <p>{box.value}</p>;",
          "}",
        ),
        "react/todo",
      ),
      fires(
        `${VIEW}/suppressed.tsx`,
        lines(
          "export function Suppressed() {",
          "  // eslint-disable-next-line react-hooks/rules-of-hooks",
          "  return <p>Suppressed</p>;",
          "}",
        ),
        "react/rule-suppression",
        "unused-disable-directive",
      ),
      fires(
        `${VIEW}/doubled-later.tsx`,
        lines(
          'import { useMemo } from "react";',
          "const two = (): number => 2;",
          "export function DoubledLater() {",
          "  const x = useMemo(two, []);",
          "  return <p>{x}</p>;",
          "}",
        ),
        "react/use-memo",
        "repo/no-manual-memo",
      ),
      fires(
        `${VIEW}/stale.tsx`,
        lines(
          'import { useCallback } from "react";',
          "export function Stale({ n }: { n: number }) {",
          "  const read = useCallback(() => n, []);",
          "  return <p>{read()}</p>;",
          "}",
        ),
        "react/memo-dependencies",
        "react/exhaustive-deps",
        "repo/no-manual-memo",
      ),
      fires(
        `${VIEW}/watched.tsx`,
        lines(
          'import { useForm } from "react-hook-form";',
          "export function Watched() {",
          "  const form = useForm();",
          '  return <p>{form.watch("name")}</p>;',
          "}",
        ),
        "react/incompatible-library",
      ),
      // Types for the incompatible library above, which is not a dependency; it must lint clean.
      {
        path: "apps/web/src/features/canary-compiler/react-hook-form.d.ts",
        code: lines(
          'declare module "react-hook-form" {',
          "  export function useForm(): { watch: (name: string) => string };",
          "}",
        ),
        reports: [],
      },
    ],
  },
  {
    convention: "accessibility: the jsx-a11y plugin's correctness rules apply to web code",
    config: '`plugins: ["react", "jsx-a11y"]` in the REACT_CODE override',
    samples: [
      fires(
        `${VIEW}/logo.tsx`,
        lines("export function Logo() {", '  return <img src="/logo.svg" />;', "}"),
        "jsx-a11y/alt-text",
      ),
    ],
  },
];

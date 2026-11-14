import { fires, lines, passes, type Case } from "../case.ts";

const HOOKS = "apps/web/src/features/canary-effects/hooks";

/** A valid effect file of `total` lines (an effect hook and an array to pad it out). */
function effectFile(total: number): string {
  const frame = [
    'import { useEffect } from "react";',
    "const STEPS: readonly number[] = [",
    "];",
    "export function useSteps(title: string): void {",
    "  useEffect(() => {",
    "    document.title = `${title} ${String(STEPS.length)}`;",
    "  }, [title]);",
    "}",
  ];
  const steps = Array.from({ length: total - frame.length }, (_, step) => `  ${String(step)},`);
  return lines(...frame.slice(0, 2), ...steps, ...frame.slice(2));
}

const TITLE_EFFECT = ["  useEffect(() => {", "    document.title = title;", "  }, [title]);", "}"];

export const EFFECT_CASES: readonly Case[] = [
  {
    convention: "React effect hooks only in *.effect.ts(x) files",
    config: "`repo/no-effect` in lint.rules, and the EFFECTS override that turns it off",
    samples: [
      fires(
        `${HOOKS}/use-title.ts`,
        lines(
          'import { useEffect } from "react";',
          "export function useTitle(title: string): void {",
          ...TITLE_EFFECT,
        ),
        "repo/no-effect",
      ),
      fires(
        "packages/ui/src/canary-layout.tsx",
        lines(
          'import * as React from "react";',
          "export function Measured({ label }: { label: string }) {",
          "  React.useLayoutEffect(() => {",
          "    document.title = label;",
          "  }, [label]);",
          "  return <p>{label}</p>;",
          "}",
        ),
        "repo/no-effect",
      ),
      passes(
        `${HOOKS}/use-title.effect.ts`,
        lines(
          'import { useEffect } from "react";',
          "export function useTitle(title: string): void {",
          ...TITLE_EFFECT,
        ),
      ),
    ],
  },
  {
    convention: "an effect file exports only useXxx hooks, uses an effect, and stays small",
    config: "`repo/effect-file` and `max-lines` (80) in the EFFECTS override",
    samples: [
      fires(
        `${HOOKS}/use-label.effect.ts`,
        lines(
          'import { useEffect } from "react";',
          'export const label = "Title";',
          "export function useLabel(title: string): void {",
          ...TITLE_EFFECT,
        ),
        "repo/effect-file",
      ),
      fires(
        `${HOOKS}/use-count.effect.ts`,
        lines(
          'import { useState } from "react";',
          "export function useCount(): number {",
          "  const [count] = useState(0);",
          "  return count;",
          "}",
        ),
        "repo/effect-file",
      ),
      fires(`${HOOKS}/use-steps.effect.ts`, effectFile(81), "max-lines"),
      passes(`${HOOKS}/use-steps-at-limit.effect.ts`, effectFile(80)),
    ],
  },
  {
    convention: "effects list their dependencies and set no state synchronously",
    config: "`react/exhaustive-deps` and `react/set-state-in-effect` in the REACT_CODE override",
    samples: [
      fires(
        `${HOOKS}/use-stale-title.effect.ts`,
        lines(
          'import { useEffect } from "react";',
          "export function useStaleTitle(title: string): void {",
          "  useEffect(() => {",
          "    document.title = title;",
          "  }, []);",
          "}",
        ),
        "react/exhaustive-deps",
        "react/exhaustive-effect-dependencies",
      ),
      fires(
        `${HOOKS}/use-mirror.effect.ts`,
        lines(
          'import { useEffect, useState } from "react";',
          "export function useMirror(value: number): number {",
          "  const [mirror, setMirror] = useState(0);",
          "  useEffect(() => {",
          "    setMirror(value);",
          "  }, [value]);",
          "  return mirror;",
          "}",
        ),
        "react/set-state-in-effect",
      ),
    ],
  },
];

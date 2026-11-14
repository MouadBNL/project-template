import { effectFile } from "./effect-file.ts";
import { ruleTester } from "./rule-tester.ts";

const filename = "/repo/apps/web/src/features/x/hooks/use-x.effect.ts";

ruleTester.run("effect-file", effectFile, {
  valid: [
    {
      filename,
      code: "import { useEffect } from 'react'; export function useTitle(t: string) { useEffect(() => {}, [t]); }",
    },
    {
      filename,
      code:
        "import * as React from 'react'; export type Target = { run: () => void };" +
        "export const useResize = () => React.useLayoutEffect(() => {});",
    },
    {
      filename,
      code: "import { useEffect } from 'react'; function useA() { useEffect(() => {}); } export { useA as useB };",
    },
  ],
  invalid: [
    {
      filename,
      code:
        "import { useEffect } from 'react'; export function useTitle() { useEffect(() => {}); }" +
        "export function parseTitle(t: string) { return t.trim(); }",
      errors: [{ messageId: "export", data: { name: "parseTitle" } }],
    },
    {
      filename,
      code: "import { useEffect } from 'react'; export const LIMIT = 3; export function useX() { useEffect(() => {}); }",
      errors: [{ messageId: "export", data: { name: "LIMIT" } }],
    },
    {
      filename,
      code: "import { useEffect } from 'react'; const helper = () => 1; export { helper }; export function useX() { useEffect(() => {}); }",
      errors: [{ messageId: "export", data: { name: "helper" } }],
    },
    {
      filename,
      code: "import { useState } from 'react'; export function useCounter() { return useState(0); }",
      errors: [{ messageId: "noEffect" }],
    },
  ],
});

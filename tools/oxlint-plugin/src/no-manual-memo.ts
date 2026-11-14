import type { Rule } from "vite-plus/lint/plugins";
import { reactApiVisitor } from "./react-api.ts";

const MEMO_APIS = new Set(["useMemo", "useCallback", "memo"]);

/**
 * The React Compiler memoizes components and hooks, so manual memoization is noise that can go
 * stale. Catches the API however it is reached: named import, `React.useMemo` through a namespace
 * or default import, destructuring from React, re-export.
 */
export const noManualMemo: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Ban useMemo, useCallback and memo: the React Compiler memoizes." },
    messages: {
      memo:
        "`{{name}}` is manual memoization, and the React Compiler already memoizes every " +
        "component and hook with exact dependencies. Write the plain expression, the inline " +
        "function or the plain component instead (docs/react.md).",
    },
  },
  create(context) {
    return reactApiVisitor(MEMO_APIS, (node, name) => {
      context.report({ node, messageId: "memo", data: { name } });
    });
  },
};

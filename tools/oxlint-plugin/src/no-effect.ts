import type { Rule } from "vite-plus/lint/plugins";
import { reactApiVisitor } from "./react-api.ts";

/**
 * React 19's hooks that run code after render to synchronise with something outside React:
 * the three effect phases (`useInsertionEffect` before layout, `useLayoutEffect` before paint,
 * `useEffect` after it), and `useEffectEvent`, whose only purpose is to be called from inside an
 * effect. `useImperativeHandle` is not here: it exposes a ref's API to a parent and synchronises
 * with nothing outside React.
 */
export const EFFECT_HOOKS: ReadonlySet<string> = new Set([
  "useEffect",
  "useLayoutEffect",
  "useInsertionEffect",
  "useEffectEvent",
]);

/** Effects are quarantined in `*.effect.ts(x)` files so every one of them is greppable. */
export const noEffect: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Ban React's effect hooks outside *.effect.ts(x) files." },
    messages: {
      effect:
        "`{{name}}` is only allowed in `*.effect.ts`/`*.effect.tsx` files. First check you need it: " +
        "derive values during render, react to events in handlers, and fetch with TanStack Query. " +
        "If you are really synchronising with an external system, write a small named hook " +
        "(`useXxx`) in a `<name>.effect.ts` file and call that (docs/react.md).",
    },
  },
  create(context) {
    return reactApiVisitor(EFFECT_HOOKS, (node, name) => {
      context.report({ node, messageId: "effect", data: { name } });
    });
  },
};

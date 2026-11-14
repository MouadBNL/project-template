import type { ESTree, Rule } from "vite-plus/lint/plugins";
import * as z from "zod";
import { memberName } from "./react-api.ts";

const Options = z.object({
  /**
   * Also check what oxlint's vitest plugin checks, for Playwright (`@playwright/test`), which the
   * vitest and jest plugins do not recognise: focused and disabled tests, tests without an
   * assertion, assertions under a condition.
   */
  playwright: z.boolean().default(false),
});

const TEST_NAMES = new Set(["it", "test"]);
/** Modifiers that still make the call a test: `test.only(...)`, `it.concurrent(...)`. */
const TEST_MODIFIERS = new Set([
  "only",
  "skip",
  "fixme",
  "fail",
  "fails",
  "concurrent",
  "sequential",
]);
const FOCUS = new Set(["only"]);
const DISABLE = new Set(["skip", "fixme"]);

type Fn = ESTree.ArrowFunctionExpression | ESTree.Function;

const isFunction = (node: ESTree.Node): node is Fn =>
  node.type === "ArrowFunctionExpression" ||
  node.type === "FunctionExpression" ||
  node.type === "FunctionDeclaration";

/** The identifier a member/call chain starts from, and the member names on the way. */
function chain(node: ESTree.Node): { root: ESTree.Node; names: string[] } {
  const names: string[] = [];
  let current = node;
  for (;;) {
    if (current.type === "MemberExpression") {
      names.unshift(memberName(current) ?? "");
      current = current.object;
    } else if (current.type === "CallExpression") {
      current = current.callee;
    } else {
      return { root: current, names };
    }
  }
}

/** `expect(x)`, `expect.soft(x)`, `expect.poll(fn)`: the call that starts an assertion. */
function isExpect(callee: ESTree.Node): boolean {
  const target = callee.type === "MemberExpression" ? callee.object : callee;
  return target.type === "Identifier" && target.name === "expect";
}

/** `test(...)`, `it.only(...)`, `test.each(table)(...)`: the callback of a test, if it is one. */
function testCallback(node: ESTree.CallExpression): Fn | undefined {
  const { root, names } = chain(node.callee);
  if (root.type !== "Identifier" || !TEST_NAMES.has(root.name)) return undefined;
  if (!names.every((name) => TEST_MODIFIERS.has(name) || name === "each")) return undefined;
  const callback = node.arguments.at(-1);
  return callback !== undefined && isFunction(callback) ? callback : undefined;
}

/** Whether `child` is a branch of `parent` that may not run. */
function isBranch(parent: ESTree.Node, child: ESTree.Node): boolean {
  if (parent.type === "IfStatement" || parent.type === "ConditionalExpression")
    return parent.test !== child;
  if (parent.type === "LogicalExpression") return parent.right === child;
  return parent.type === "SwitchCase" || parent.type === "CatchClause";
}

/**
 * Tests that cannot pass without checking something. For every suite: no early `return` under a
 * condition (the test then passes without reaching its assertions). With `playwright: true`, also
 * no `.only` / `.skip` / `.fixme`, every test asserts, and no assertion sits under a condition.
 */
export const testHygiene: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Tests must assert, unconditionally, and not be focused or skipped." },
    schema: [{ type: "object", additionalProperties: true }],
    messages: {
      earlyReturn:
        "This `return` lets the test pass without reaching its assertions. Assert the condition " +
        "instead: `assert(row !== undefined)` (vite-plus/test) narrows the type, or " +
        "`expect(row).toBeDefined()` before using it.",
      focused:
        "`.only` makes the rest of the suite silently skip. Remove it before committing (run one " +
        "test with `pnpm -C e2e exec playwright test tests/<file>.spec.ts -g '<title>'`).",
      disabled:
        "`.{{name}}` disables a test, which then proves nothing. Fix the test or the app, or " +
        "delete the test.",
      noExpect:
        "This test asserts nothing, so it passes whenever it does not crash. Add an `expect(...)` " +
        "in its body for the outcome it proves.",
      conditionalExpect:
        "This `expect` runs only under a condition, so the test can pass without it. Assert the " +
        "condition itself, then the value, unconditionally.",
    },
  },
  create(context) {
    const parsed = Options.safeParse(context.options[0] ?? {});
    const playwright = parsed.success && parsed.data.playwright;
    /** Test callbacks seen so far, with whether they called `expect`. */
    const tests = new Map<ESTree.Node, boolean>();

    /** The nearest test callback around `node`, and whether `node` is in a conditional branch. */
    const enclosingTest = (
      node: ESTree.Node,
      stopAtFunction: boolean,
    ): { test: ESTree.Node; conditional: boolean } | undefined => {
      let conditional = false;
      let child = node;
      for (let parent = node.parent; parent !== null; parent = parent.parent) {
        if (tests.has(parent)) return { test: parent, conditional };
        if (stopAtFunction && isFunction(parent)) return undefined;
        if (isBranch(parent, child)) conditional = true;
        child = parent;
      }
      return undefined;
    };

    return {
      CallExpression(node) {
        const callback = testCallback(node);
        if (callback !== undefined) {
          tests.set(callback, false);
          return;
        }
        if (!playwright) return;
        if (!isExpect(node.callee)) return;
        const found = enclosingTest(node, false);
        if (found === undefined) return;
        tests.set(found.test, true);
        if (found.conditional) context.report({ node, messageId: "conditionalExpect" });
      },
      "CallExpression:exit"(node) {
        if (!playwright) return;
        const callback = testCallback(node);
        if (callback !== undefined && tests.get(callback) === false) {
          context.report({ node: node.callee, messageId: "noExpect" });
        }
      },
      ReturnStatement(node) {
        const found = enclosingTest(node, true);
        if (found?.conditional === true) context.report({ node, messageId: "earlyReturn" });
      },
      MemberExpression(node) {
        if (!playwright) return;
        const name = memberName(node);
        if (name === undefined) return;
        const { root } = chain(node.object);
        if (root.type !== "Identifier" || !TEST_NAMES.has(root.name)) return;
        if (FOCUS.has(name)) context.report({ node: node.property, messageId: "focused" });
        else if (DISABLE.has(name))
          context.report({ node: node.property, messageId: "disabled", data: { name } });
      },
    };
  },
};

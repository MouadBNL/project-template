import type { Context, ESTree, Rule, Scope, Variable } from "vite-plus/lint/plugins";
import { memberName } from "./react-api.ts";

const ADAPTER =
  "Only `*.adapter.ts` files may throw, catch or reject, to wrap third-party code (see docs/errors.md).";
const FROM_PROMISE =
  "Use `fromPromise` from @app/result to turn the rejecting call into a Result, and branch on " +
  "`result.ok`.";

/** Errors are values: no throw, catch or rejection outside `*.adapter.ts`. */
export const noThrow: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Ban throw, try/catch, .catch(), rejections and Error subclasses outside *.adapter.ts.",
    },
    messages: {
      throw: `\`throw\` is not allowed here. Return an error value instead: \`return err({ type: "..." })\` from @app/result. ${ADAPTER}`,
      errorClass:
        '`{{name}}` subclasses an Error. Errors are tagged values (`{ type: "not_found" }`), ' +
        "created with `err()` from @app/result; add the variant to the function's error union " +
        "instead (docs/errors.md).",
      try: `\`try\`/\`catch\` is not allowed here. Call \`fromThrowable\`/\`fromPromise\` from @app/result to turn the throwing call into a Result. ${ADAPTER}`,
      catch:
        `\`.catch()\` on a promise is not allowed here. ${FROM_PROMISE} ${ADAPTER} If this is a ` +
        'Zod schema\'s `.catch`, pass the fallback value (`.catch("todo")`) or build the schema ' +
        "from `z` in this file, so the rule can tell it is Zod.",
      thenReject: `A rejection handler (the second argument of \`.then\`) catches errors. ${FROM_PROMISE} ${ADAPTER}`,
      reject: `\`{{name}}\` produces a rejected promise, which is a thrown error. Return \`err({ type: "..." })\` instead, or resolve with a Result. ${ADAPTER}`,
    },
  },
  create(context) {
    const checkClass = (node: ESTree.Class): void => {
      const { superClass } = node;
      if (superClass?.type === "Identifier" && superClass.name.endsWith("Error")) {
        const name = node.id?.name ?? "This class";
        context.report({ node: superClass, messageId: "errorClass", data: { name } });
      }
    };
    return {
      ThrowStatement(node) {
        context.report({ node, messageId: "throw" });
      },
      TryStatement(node) {
        context.report({ node, messageId: "try" });
      },
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
      MemberExpression(node) {
        const name = memberName(node);
        if (name === "catch" && !isFallbackCatch(context, node)) {
          context.report({ node: node.property, messageId: "catch" });
        } else if (name === "then" && node.parent.type === "CallExpression") {
          const call = node.parent;
          const handler = call.callee === node ? call.arguments[1] : undefined;
          if (handler !== undefined) context.report({ node: handler, messageId: "thenReject" });
        } else if (name === "reject") {
          if (isPromise(node.object)) {
            context.report({ node, messageId: "reject", data: { name: "Promise.reject" } });
          } else if (isWithResolvers(context, node.object)) {
            context.report({ node, messageId: "reject", data: { name: "reject" } });
          }
        }
      },
      NewExpression(node) {
        if (!isPromise(node.callee)) return;
        const [executor] = node.arguments;
        if (executor?.type !== "ArrowFunctionExpression" && executor?.type !== "FunctionExpression")
          return;
        const reject = executor.params[1];
        if (reject !== undefined) {
          context.report({ node: reject, messageId: "reject", data: { name: "reject" } });
        }
      },
      VariableDeclarator(node) {
        if (node.id.type !== "ObjectPattern" || node.init === null) return;
        if (!isWithResolversCall(node.init)) return;
        for (const property of node.id.properties) {
          if (property.type !== "Property" || property.computed) continue;
          if (property.key.type === "Identifier" && property.key.name === "reject") {
            context.report({ node: property, messageId: "reject", data: { name: "reject" } });
          }
        }
      },
    };
  },
};

const isPromise = (node: ESTree.Node): boolean =>
  node.type === "Identifier" && node.name === "Promise";

/** `Promise.withResolvers()` or `Promise.withResolvers<T>()`. */
function isWithResolversCall(node: ESTree.Node): boolean {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    isPromise(node.callee.object) &&
    memberName(node.callee) === "withResolvers"
  );
}

/** `d` in `d.reject(...)`, when `const d = Promise.withResolvers()`. */
function isWithResolvers(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "Identifier") return false;
  const init = constInit(resolve(context.sourceCode.getScope(node), node.name));
  return init !== undefined && isWithResolversCall(init);
}

function resolve(scope: Scope | null, name: string): Variable | undefined {
  for (let current = scope; current !== null; current = current.upper) {
    const found = current.set.get(name);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The initializer of a `const` binding, if the variable is one. */
function constInit(variable: Variable | undefined): ESTree.Expression | undefined {
  const [def] = variable?.defs ?? [];
  if (def?.type !== "Variable" || def.node.type !== "VariableDeclarator") return undefined;
  if (def.parent?.type !== "VariableDeclaration" || def.parent.kind !== "const") return undefined;
  return def.node.init ?? undefined;
}

/** The identifier a member/call chain starts from: `z` in `z.enum([...]).optional()`. */
function rootOf(node: ESTree.Node): ESTree.Node {
  let current = node;
  for (;;) {
    if (current.type === "CallExpression") current = current.callee;
    else if (current.type === "MemberExpression") current = current.object;
    else if (current.type === "ChainExpression") current = current.expression;
    else if (current.type === "TSNonNullExpression") current = current.expression;
    else return current;
  }
}

const isZodSource = (source: string): boolean => source === "zod" || source.startsWith("zod/");

/** Whether an expression is built from an import of `zod`, directly or through local consts. */
function isZod(context: Context, node: ESTree.Node, depth = 0): boolean {
  const root = rootOf(node);
  if (root.type !== "Identifier" || depth > 8) return false;
  const variable = resolve(context.sourceCode.getScope(root), root.name);
  const [def] = variable?.defs ?? [];
  if (def?.type === "ImportBinding") {
    return def.parent?.type === "ImportDeclaration" && isZodSource(def.parent.source.value);
  }
  const init = constInit(variable);
  return init !== undefined && isZod(context, init, depth + 1);
}

/**
 * Zod's `.catch(fallback)` replaces an invalid value; it has nothing to do with promises. It is
 * recognised when the chain is built from a `zod` import in this file, or when the argument is a
 * plain value (on a promise, `.catch` with a non-function is a no-op and catches nothing).
 */
function isFallbackCatch(context: Context, node: ESTree.MemberExpression): boolean {
  const { parent } = node;
  if (parent.type === "CallExpression" && parent.callee === node) {
    const [argument] = parent.arguments;
    if (argument !== undefined && isPlainValue(argument)) return true;
  }
  return isZod(context, node.object);
}

const PLAIN_VALUES: ReadonlySet<string> = new Set([
  "Literal",
  "TemplateLiteral",
  "ArrayExpression",
  "ObjectExpression",
  "UnaryExpression",
  "BinaryExpression",
]);

function isPlainValue(node: ESTree.Node): boolean {
  if (node.type === "Identifier") return node.name === "undefined";
  return PLAIN_VALUES.has(node.type);
}

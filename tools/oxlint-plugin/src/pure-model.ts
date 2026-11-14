import type { Context, ESTree, Rule, Scope } from "vite-plus/lint/plugins";
import * as z from "zod";
import { memberName } from "./react-api.ts";

/** `Object.member` calls whose result depends on when or where they run. */
const IMPURE_CALLS: Readonly<Record<string, ReadonlySet<string>>> = {
  Date: new Set(["now"]),
  Math: new Set(["random"]),
  performance: new Set(["now"]),
  crypto: new Set(["randomUUID", "getRandomValues"]),
};
/** Browser globals: reading or writing them is IO. */
const IO_GLOBALS = new Set([
  "window",
  "document",
  "localStorage",
  "sessionStorage",
  "navigator",
  "location",
  "history",
  "indexedDB",
]);
const Options = z.object({
  /**
   * Imports that read the clock or a random source, by module: `{ "@app/ids": ["newId"] }` bans
   * calling `newId` imported from `@app/ids`. For the project's own helpers, which the rule cannot
   * see through.
   */
  impureImports: z.record(z.string(), z.array(z.string())).default({}),
});

/**
 * `features/<name>/model/` holds pure functions: the same input gives the same output, and nothing
 * outside is read or written. That is what lets the model be tested as plain functions without
 * mocks. (The boundaries rule already keeps React, the router and IO libraries out by import.)
 */
export const pureModel: Rule = {
  meta: {
    type: "problem",
    docs: { description: "model/ code reads no clock, random source or browser global." },
    schema: [{ type: "object", additionalProperties: true }],
    messages: {
      impure:
        "`{{name}}` makes this model function depend on when or where it runs. Take the value as " +
        "a parameter (`now: Date`, `id: string`) and produce it in the hook or action that " +
        "calls the model (docs/react.md).",
      io:
        "`{{name}}` is a browser global: reading or writing it is IO, which model/ must not do. " +
        "Pass the value in as a parameter, or move the code to api/ (storage) or hooks/.",
      options: "Invalid repo/pure-model options: {{issues}}",
    },
  },
  create(context) {
    const parsed = Options.safeParse(context.options[0] ?? {});
    if (!parsed.success) {
      return {
        Program(node) {
          const issues = z.prettifyError(parsed.error);
          context.report({ node, messageId: "options", data: { issues } });
        },
      };
    }
    const { impureImports } = parsed.data;
    const impureLocals = new Map<string, string>();
    const isGlobal = (node: ESTree.Node & { readonly name: string }) => isUnbound(context, node);
    return {
      ImportDeclaration(node) {
        const banned = impureImports[node.source.value];
        if (banned !== undefined) collectImpureLocals(node, banned, impureLocals);
      },
      CallExpression(node) {
        const { callee } = node;
        if (callee.type === "Identifier") {
          const name = impureLocals.get(callee.name);
          if (name !== undefined)
            context.report({ node, messageId: "impure", data: { name: `${name}()` } });
          return;
        }
        if (callee.type !== "MemberExpression" || callee.object.type !== "Identifier") return;
        const property = memberName(callee);
        const object = callee.object.name;
        if (property !== undefined && IMPURE_CALLS[object]?.has(property) === true) {
          if (isGlobal(callee.object))
            context.report({
              node,
              messageId: "impure",
              data: { name: `${object}.${property}()` },
            });
        }
      },
      NewExpression(node) {
        const { callee } = node;
        if (callee.type !== "Identifier" || callee.name !== "Date") return;
        if (node.arguments.length === 0 && isGlobal(callee)) {
          context.report({ node, messageId: "impure", data: { name: "new Date()" } });
        }
      },
      Identifier(node) {
        if (!IO_GLOBALS.has(node.name) || isName(node) || !isGlobal(node)) return;
        context.report({ node, messageId: "io", data: { name: node.name } });
      },
    };
  },
};

/** Not bound in this file: a parameter or local called `location` is fine. */
function isUnbound(context: Context, node: ESTree.Node & { readonly name: string }): boolean {
  for (let scope: Scope | null = context.sourceCode.getScope(node); scope; scope = scope.upper) {
    const variable = scope.set.get(node.name);
    if (variable !== undefined && variable.defs.length > 0) return false;
  }
  return true;
}

/** Records the local names under which `node` imports one of `banned` (value imports only). */
function collectImpureLocals(
  node: ESTree.ImportDeclaration,
  banned: readonly string[],
  locals: Map<string, string>,
): void {
  if (node.importKind === "type") return;
  for (const specifier of node.specifiers) {
    if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
    const { imported } = specifier;
    const name = imported.type === "Literal" ? imported.value : imported.name;
    if (banned.includes(name)) locals.set(specifier.local.name, name);
  }
}

/** A property or member name (`row.document`, `{ window: 1 }`), not a reference to a variable. */
function isName(node: ESTree.Node): boolean {
  const { parent } = node;
  if (parent === null) return false;
  if (parent.type === "MemberExpression") return parent.property === node && !parent.computed;
  if (parent.type === "Property")
    return parent.key === node && !parent.computed && !parent.shorthand;
  if (
    parent.type === "MethodDefinition" ||
    parent.type === "PropertyDefinition" ||
    parent.type === "TSPropertySignature" ||
    parent.type === "TSMethodSignature"
  )
    return parent.key === node && !parent.computed;
  return parent.type === "TSQualifiedName" && parent.right === node;
}

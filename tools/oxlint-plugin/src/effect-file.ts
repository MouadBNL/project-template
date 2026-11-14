import type { ESTree, Rule } from "vite-plus/lint/plugins";
import { EFFECT_HOOKS } from "./no-effect.ts";
import { reactApiVisitor } from "./react-api.ts";

const HOOK_NAME = /^use[A-Z]/u;

/** The value names a declaration exports; types and interfaces export no value. */
function exportedValues(declaration: ESTree.Declaration): ESTree.BindingIdentifier[] {
  if (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration")
    return declaration.id === null ? [] : [declaration.id];
  if (declaration.type === "VariableDeclaration")
    return declaration.declarations.flatMap((declarator) =>
      declarator.id.type === "Identifier" ? [declarator.id] : [],
    );
  return [];
}

/**
 * Keeps `*.effect.ts(x)` files honest: they are where effects are allowed, so they hold small
 * named hooks that use one and nothing else. Every exported value is a `useXxx` hook (types are
 * fine), and the file uses an effect hook (otherwise it is an ordinary hook and belongs in a
 * plain `hooks/use-xxx.ts`, where the no-effect rule keeps watching it).
 */
export const effectFile: Rule = {
  meta: {
    type: "problem",
    docs: { description: "*.effect.ts(x) files export only hooks, and use an effect." },
    messages: {
      export:
        "`{{name}}` is exported from an effect file, which may export only `useXxx` hooks (and " +
        "types). Move it to model/ (a calculation), api/ (data access) or a plain hooks/ file, " +
        "and import it here.",
      noEffect:
        "This effect file uses no effect hook (useEffect, useLayoutEffect, useInsertionEffect, " +
        "useEffectEvent). Rename it to a plain `use-xxx.ts` so the no-effect rule applies to it.",
    },
  },
  create(context) {
    let usesEffect = false;
    const imports = reactApiVisitor(EFFECT_HOOKS, () => {
      usesEffect = true;
    });
    const checkName = (node: ESTree.Node, name: string): void => {
      if (!HOOK_NAME.test(name)) context.report({ node, messageId: "export", data: { name } });
    };
    return {
      ...imports,
      ExportNamedDeclaration(node) {
        imports.ExportNamedDeclaration?.(node);
        if (node.exportKind === "type") return;
        if (node.declaration !== null) {
          for (const id of exportedValues(node.declaration)) checkName(id, id.name);
          return;
        }
        for (const specifier of node.specifiers) {
          if (specifier.exportKind === "type") continue;
          const { exported } = specifier;
          checkName(specifier, exported.type === "Literal" ? exported.value : exported.name);
        }
      },
      ExportDefaultDeclaration(node) {
        checkName(node, "default");
      },
      "Program:exit"(node) {
        if (!usesEffect) context.report({ node, messageId: "noEffect" });
      },
    };
  },
};

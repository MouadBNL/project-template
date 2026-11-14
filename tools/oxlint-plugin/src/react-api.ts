import type { ESTree, Visitor } from "vite-plus/lint/plugins";

const REACT = "react";

const nameOf = (node: ESTree.IdentifierName | ESTree.StringLiteral | ESTree.ModuleExportName) =>
  node.type === "Literal" ? node.value : node.name;

/** `x.name` and `x["name"]`: the property name, or undefined when it is computed. */
export function memberName(node: ESTree.MemberExpression): string | undefined {
  const { property } = node;
  if (!node.computed && property.type === "Identifier") return property.name;
  if (node.computed && property.type === "Literal" && typeof property.value === "string")
    return property.value;
  return undefined;
}

/**
 * Finds every reference to the named exports of `react`, however it is reached:
 * `import { useMemo as m }`, `export { useMemo } from "react"`, `React.useMemo` and
 * `React["useMemo"]` through a namespace or default import, and `const { useMemo } = React`.
 * Type-only imports are ignored. A name read off an object that is not React (`row.memo`) is not
 * a reference.
 */
export function reactApiVisitor(
  names: ReadonlySet<string>,
  report: (node: ESTree.Node, name: string) => void,
): Visitor {
  /** Local names bound to the React module (`import * as React`, `import React`). */
  const modules = new Set<string>();
  const isReactModule = (node: ESTree.Node): boolean =>
    node.type === "Identifier" && modules.has(node.name);

  return {
    Program(program) {
      for (const statement of program.body) {
        if (statement.type !== "ImportDeclaration" || statement.source.value !== REACT) continue;
        if (statement.importKind === "type") continue;
        for (const specifier of statement.specifiers) {
          if (specifier.type !== "ImportSpecifier") modules.add(specifier.local.name);
        }
      }
    },
    ImportDeclaration(node) {
      if (node.source.value !== REACT || node.importKind === "type") return;
      for (const specifier of node.specifiers) {
        if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
        const name = nameOf(specifier.imported);
        if (names.has(name)) report(specifier, name);
      }
    },
    ExportNamedDeclaration(node) {
      if (node.source?.value !== REACT || node.exportKind === "type") return;
      for (const specifier of node.specifiers) {
        const name = nameOf(specifier.local);
        if (names.has(name)) report(specifier, name);
      }
    },
    MemberExpression(node) {
      if (!isReactModule(node.object)) return;
      const name = memberName(node);
      if (name !== undefined && names.has(name)) report(node.property, name);
    },
    VariableDeclarator(node) {
      if (node.init === null || !isReactModule(node.init) || node.id.type !== "ObjectPattern")
        return;
      for (const property of node.id.properties) {
        if (property.type !== "Property" || property.computed) continue;
        const { key } = property;
        const name = key.type === "Identifier" ? key.name : undefined;
        if (name !== undefined && names.has(name)) report(property, name);
      }
    },
  };
}

import type { ESTree, Rule } from "vite-plus/lint/plugins";

/** Calls whose string arguments are Tailwind classes. */
const CLASS_FUNCTIONS = new Set(["tv", "cn", "cx"]);
const CLASS_ATTRIBUTES = new Set(["className", "class"]);

/** Tailwind's built-in palette. The theme resets it, so these classes would silently do nothing. */
const PALETTE =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|black|white";
const COLOR_PREFIX =
  "bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|shadow|inset-shadow|inset-ring|divide|placeholder|caret|accent|decoration";
const PALETTE_UTILITY = new RegExp(
  `^-?(?:${COLOR_PREFIX})-(?:${PALETTE})(?:-\\d{2,3})?(?:/.+)?$`,
  "u",
);
const RAW_COLOR = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/iu;
const LENGTH = /\d(?:px|rem|em)\b/u;

type Context = "class" | "style";

/** The utility part of a class, after its variants: "hover:data-[x]:bg-surface" -> "bg-surface". */
function utilityOf(token: string): string {
  let depth = 0;
  let start = 0;
  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
    if (char === "[" || char === "(") depth += 1;
    else if (char === "]" || char === ")") depth -= 1;
    else if (char === ":" && depth === 0) start = index + 1;
  }
  return token.slice(start).replace(/^!|!$/gu, "");
}

type Problem = { readonly messageId: "palette" | "arbitrary" | "style"; readonly value: string };

function classProblems(text: string): Problem[] {
  return text
    .split(/\s+/u)
    .filter((token) => token !== "")
    .flatMap((token): Problem[] => {
      const utility = utilityOf(token);
      if (PALETTE_UTILITY.test(utility)) return [{ messageId: "palette", value: token }];
      const bracket = utility.indexOf("[");
      if (bracket === -1) return [];
      const arbitrary = utility.slice(bracket);
      return RAW_COLOR.test(arbitrary) || LENGTH.test(arbitrary)
        ? [{ messageId: "arbitrary", value: token }]
        : [];
    });
}

function styleProblems(text: string): Problem[] {
  return RAW_COLOR.test(text) || LENGTH.test(text) ? [{ messageId: "style", value: text }] : [];
}

/** Whether a string sits inside a className/style attribute or a tv()/cn()/cx() call. */
function contextOf(node: ESTree.Node): Context | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === "JSXAttribute" && current.name.type === "JSXIdentifier") {
      if (CLASS_ATTRIBUTES.has(current.name.name)) return "class";
      if (current.name.name === "style") return "style";
      return undefined;
    }
    if (
      current.type === "CallExpression" &&
      current.callee.type === "Identifier" &&
      CLASS_FUNCTIONS.has(current.callee.name)
    ) {
      return "class";
    }
  }
  return undefined;
}

/**
 * Components are styled with design tokens only (packages/ui/src/styles.css): no Tailwind default
 * palette, no arbitrary values that hard-code a colour or a length, no raw colours or lengths in
 * inline styles. Arbitrary values that are not colours or lengths (grid templates, `var(--x)`,
 * viewport units) and arbitrary variants (`data-[side=top]:`) are fine.
 */
export const designTokens: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Style components with design tokens, not raw colours or lengths." },
    messages: {
      palette:
        "`{{value}}` uses Tailwind's default palette, which the theme switches off. Use a semantic " +
        "colour token instead (`bg-surface`, `text-fg-muted`, `border-line`, `bg-accent`, " +
        "`text-danger`, ...) from packages/ui/src/styles.css.",
      arbitrary:
        "`{{value}}` hard-codes a colour or a length. Use the theme scales (`h-8`, `px-3`, `text-sm`, " +
        "`rounded-md`) or a colour token; if the design needs a new value, add a token to " +
        "packages/ui/src/styles.css.",
      style:
        "Inline style hard-codes `{{value}}`. Use a class with a design token instead, or a CSS " +
        "variable from packages/ui/src/styles.css.",
    },
  },
  create(context) {
    const check = (node: ESTree.Node, text: string): void => {
      const where = contextOf(node);
      if (where === undefined) return;
      const problems = where === "class" ? classProblems(text) : styleProblems(text);
      for (const { messageId, value } of problems) {
        context.report({ node, messageId, data: { value } });
      }
    };
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};

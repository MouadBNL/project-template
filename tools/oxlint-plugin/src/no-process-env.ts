import type { Rule } from "vite-plus/lint/plugins";

/** Environment is read and validated in exactly one place per app. */
export const noProcessEnv: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Ban process.env outside env.ts and tool configs." },
    messages: {
      env:
        "Do not read `process.env` here. Add the variable to the Zod schema in `src/env.ts` of " +
        'this app and receive the parsed value as an argument (docs/backend.md, "Environment").',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        const { object, property } = node;
        if (
          object.type === "Identifier" &&
          object.name === "process" &&
          !node.computed &&
          property.type === "Identifier" &&
          property.name === "env"
        ) {
          context.report({ node, messageId: "env" });
        }
      },
    };
  },
};

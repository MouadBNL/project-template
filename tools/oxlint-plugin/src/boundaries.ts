import { builtinModules } from "node:module";
import path from "node:path";
import type { ESTree, Rule } from "vite-plus/lint/plugins";
import * as z from "zod";
import { readWorkspacePackages, REPO_ROOT } from "./workspace.ts";

const Options = z.object({
  /**
   * Files matching `from` (minus `except`) may not import files matching `disallow`
   * (repo-relative globs).
   */
  zones: z
    .array(
      z.object({
        from: z.array(z.string()),
        except: z.array(z.string()).default([]),
        disallow: z.array(z.string()),
        message: z.string(),
      }),
    )
    .default([]),
  /**
   * Files matching `from` (minus `except`) may only import these npm packages
   * ("zod", "@orpc/*"). Node built-ins count as packages.
   */
  externals: z
    .array(
      z.object({
        from: z.array(z.string()),
        except: z.array(z.string()).default([]),
        allow: z.array(z.string()),
        message: z.string(),
      }),
    )
    .default([]),
  /** Each direct subfolder of `root` is a module; code outside it may only import its `index.ts`. */
  modules: z.array(z.object({ root: z.string() })).default([]),
});
type Options = z.infer<typeof Options>;

type Target =
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "external"; readonly name: string };

const BUILTINS = new Set(builtinModules);

function packageName(specifier: string): string {
  const [first = "", second = ""] = specifier.split("/");
  return first.startsWith("@") ? `${first}/${second}` : first;
}

function resolveTarget(
  specifier: string,
  importer: string,
  workspace: ReadonlyMap<string, string>,
): Target {
  if (specifier.startsWith(".")) {
    const absolute = path.resolve(path.dirname(importer), specifier);
    return { kind: "file", path: path.relative(REPO_ROOT, absolute).split(path.sep).join("/") };
  }
  const name = packageName(specifier);
  const dir = workspace.get(name);
  if (dir !== undefined) {
    const subpath = specifier.slice(name.length).replace(/^\//, "");
    return { kind: "file", path: `${dir}/${subpath === "" ? "index.ts" : subpath}` };
  }
  if (specifier.startsWith("node:") || BUILTINS.has(name))
    return { kind: "external", name: specifier };
  return { kind: "external", name };
}

const matches = (file: string, globs: readonly string[]): boolean =>
  globs.some((glob) => path.matchesGlob(file, glob));

const allowsPackage = (name: string, allow: readonly string[]): boolean =>
  allow.some((pattern) =>
    pattern.endsWith("/*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern,
  );

/** "apps/api/src/modules/users/x.ts" -> "users" when root is "apps/api/src/modules". */
function moduleOf(file: string, root: string): string | undefined {
  if (!file.startsWith(`${root}/`)) return undefined;
  const [name] = file.slice(root.length + 1).split("/");
  return name;
}

function violation(options: Options, importer: string, target: Target): string | undefined {
  if (target.kind === "external") {
    for (const rule of options.externals) {
      const applies = matches(importer, rule.from) && !matches(importer, rule.except);
      if (applies && !allowsPackage(target.name, rule.allow)) return rule.message;
    }
    return undefined;
  }
  for (const zone of options.zones) {
    const applies = matches(importer, zone.from) && !matches(importer, zone.except);
    if (applies && matches(target.path, zone.disallow)) return zone.message;
  }
  for (const { root } of options.modules) {
    const targetModule = moduleOf(target.path, root);
    if (targetModule === undefined || targetModule === moduleOf(importer, root)) continue;
    const entry = `${root}/${targetModule}/index.ts`;
    if (target.path !== entry) {
      return (
        `Import the "${targetModule}" module only through its public entry \`${entry}\`. ` +
        `If you need something it does not export yet, export it from that index.ts.`
      );
    }
  }
  return undefined;
}

/** Architecture boundaries between apps, packages and API modules. Configured in vite.config.ts. */
export const boundaries: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Enforce import boundaries between apps, packages and API modules." },
    schema: [{ type: "object", additionalProperties: true }],
    messages: { boundary: '{{message}} (import of "{{specifier}}")' },
  },
  create(context) {
    const parsed = Options.safeParse(context.options[0] ?? {});
    if (!parsed.success) {
      return {
        Program(node) {
          context.report({
            node,
            messageId: "boundary",
            data: {
              message: `Invalid repo/boundaries options: ${z.prettifyError(parsed.error)}`,
              specifier: "",
            },
          });
        },
      };
    }
    const options = parsed.data;
    const workspace = readWorkspacePackages();
    const importer = path.relative(REPO_ROOT, context.filename).split(path.sep).join("/");

    const check = (node: ESTree.Node, specifier: string): void => {
      const message = violation(
        options,
        importer,
        resolveTarget(specifier, context.filename, workspace),
      );
      if (message !== undefined) {
        context.report({ node, messageId: "boundary", data: { message, specifier } });
      }
    };

    return {
      ImportDeclaration(node) {
        check(node.source, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node.source, node.source.value);
      },
      ExportAllDeclaration(node) {
        check(node.source, node.source.value);
      },
      ImportExpression(node) {
        const { source } = node;
        if (source.type === "Literal" && typeof source.value === "string")
          check(source, source.value);
      },
    };
  },
};

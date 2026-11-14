import { pureModel } from "./pure-model.ts";
import { ruleTester } from "./rule-tester.ts";

ruleTester.run("pure-model", pureModel, {
  valid: [
    "export const label = (now: Date) => ({ createdAt: now });",
    "const at = new Date('2026-01-01'); const copy = new Date(at.getTime());",
    {
      code: "import { ItemId, type OwnerId } from '@app/ids'; ItemId.parse(x);",
      options: [{ impureImports: { "@app/ids": ["newId"] } }],
    },
    "import { newId } from '@app/ids'; const id = newId(ItemId);",
    "const Date = { now: () => 0 }; Date.now();",
    "function f(location: string) { return location.trim(); }",
    "const row = { document: 'x' }; row.document;",
    "Math.max(1, 2);",
  ],
  invalid: [
    {
      code: "export const stamp = () => new Date();",
      errors: [{ messageId: "impure", data: { name: "new Date()" } }],
    },
    {
      code: "const t = Date.now();",
      errors: [{ messageId: "impure", data: { name: "Date.now()" } }],
    },
    {
      code: "const pick = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)];",
      errors: [{ messageId: "impure", data: { name: "Math.random()" } }],
    },
    {
      code: "const id = crypto.randomUUID();",
      errors: [{ messageId: "impure", data: { name: "crypto.randomUUID()" } }],
    },
    {
      code: "import { newId as mint, ItemId } from '@app/ids'; const id = mint(ItemId);",
      options: [{ impureImports: { "@app/ids": ["newId"] } }],
      errors: [{ messageId: "impure", data: { name: "newId()" } }],
    },
    {
      code: "const t = 1;",
      options: [{ impureImports: ["newId"] }],
      errors: [{ messageId: "options" }],
    },
    {
      code: "const saved = localStorage.getItem('theme');",
      errors: [{ messageId: "io", data: { name: "localStorage" } }],
    },
    {
      code: "const width = window.innerWidth;",
      errors: [{ messageId: "io", data: { name: "window" } }],
    },
  ],
});

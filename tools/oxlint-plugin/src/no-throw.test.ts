import { noThrow } from "./no-throw.ts";
import { ruleTester } from "./rule-tester.ts";

ruleTester.run("no-throw", noThrow, {
  valid: [
    "const r = err({ type: 'not_found' });",
    "promise.then((value) => use(value));",
    // .finally cannot swallow a rejection: it runs and the rejection goes on.
    "task().finally(() => release());",
    "new Promise((resolve) => setTimeout(resolve, 10));",
    "const { promise, resolve } = Promise.withResolvers();",
    "const held = Promise.withResolvers(); held.resolve(1);",
    // Zod's .catch: built from z in this file, directly or through consts.
    "import * as z from 'zod'; const Status = z.enum(['a', 'b']).catch(() => 'a');",
    "import * as z from 'zod'; const Base = z.string(); const Name = Base.min(1); Name.catch((ctx) => String(ctx.input));",
    "import { z } from 'zod/v4'; z.number().catch(fallback);",
    // A plain fallback value: Zod style; on a promise it would catch nothing.
    "import { OrderStatus } from '@app/contracts'; OrderStatus.catch('draft');",
    "Schema.catch([]);",
    "Schema.catch(undefined);",
    "rejectOrder(id);",
    "class Hub extends EventTarget {}",
    "type E<T extends TaggedError> = T;",
  ],
  invalid: [
    { code: "throw new Error('x');", errors: [{ messageId: "throw" }] },
    {
      code: "class NotFound extends Error {}",
      errors: [{ messageId: "errorClass", data: { name: "NotFound" } }],
    },
    {
      code: "const Gone = class extends TypeError {};",
      errors: [{ messageId: "errorClass", data: { name: "This class" } }],
    },
    { code: "try { f(); } catch { g(); }", errors: [{ messageId: "try" }] },
    { code: "try { f(); } finally { g(); }", errors: [{ messageId: "try" }] },
    { code: "fetch(url).catch(() => null);", errors: [{ messageId: "catch" }] },
    { code: "fetch(url).catch(handle);", errors: [{ messageId: "catch" }] },
    { code: "obj['catch'](handle);", errors: [{ messageId: "catch" }] },
    { code: "const c = p.catch; c(handle);", errors: [{ messageId: "catch" }] },
    { code: "Promise.prototype.catch.call(p, handle);", errors: [{ messageId: "catch" }] },
    { code: "p?.catch(() => 1);", errors: [{ messageId: "catch" }] },
    // A local that only looks like Zod.
    {
      code: "const z = { string: () => fetch(url) }; z.string().catch(() => null);",
      errors: [{ messageId: "catch" }],
    },
    // Bypasses closed: rejection handlers and rejected promises.
    { code: "p.then(onOk, onErr);", errors: [{ messageId: "thenReject" }] },
    { code: "p.then(undefined, () => null);", errors: [{ messageId: "thenReject" }] },
    {
      code: "const r = Promise.reject(new Error('x'));",
      errors: [{ messageId: "reject", data: { name: "Promise.reject" } }],
    },
    {
      code: "const fail = Promise.reject.bind(Promise);",
      errors: [{ messageId: "reject", data: { name: "Promise.reject" } }],
    },
    {
      code: "new Promise((resolve, reject) => reject(cause));",
      errors: [{ messageId: "reject", data: { name: "reject" } }],
    },
    {
      code: "new Promise(function (_, fail) { fail(cause); });",
      errors: [{ messageId: "reject", data: { name: "reject" } }],
    },
    {
      code: "const { promise, reject } = Promise.withResolvers();",
      errors: [{ messageId: "reject", data: { name: "reject" } }],
    },
    {
      code: "const held = Promise.withResolvers<number>(); held.reject(cause);",
      errors: [{ messageId: "reject", data: { name: "reject" } }],
    },
  ],
});

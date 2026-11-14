import { noProcessEnv } from "./no-process-env.ts";
import { ruleTester } from "./rule-tester.ts";

ruleTester.run("no-process-env", noProcessEnv, {
  valid: ["const port = env.API_PORT;", "process.exit(1);"],
  invalid: [
    { code: "const port = process.env.API_PORT;", errors: [{ messageId: "env" }] },
    { code: "const { API_PORT } = process.env;", errors: [{ messageId: "env" }] },
  ],
});

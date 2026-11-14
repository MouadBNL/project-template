import { os } from "../../orpc/implementer.ts";
import { respond } from "../../orpc/procedures.ts";
import { checkHealth } from "./health.ts";

const health = os.system.health.handler(async ({ context, errors }) =>
  respond(await checkHealth(context), errors),
);

export const systemRouter = { health };

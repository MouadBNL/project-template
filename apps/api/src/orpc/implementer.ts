import { contract } from "@app/contracts";
import { implement } from "@orpc/server";
import type { Context } from "../context.ts";

/**
 * Start every procedure from here: `os.<module>.<procedure>.handler(...)`.
 * The contract fixes input, output and declared errors; this adds our context.
 */
export const os = implement(contract).$context<Context>();

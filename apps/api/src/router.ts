import { systemRouter } from "./modules/system/index.ts";
import { os } from "./orpc/implementer.ts";

/** `.router()` checks the whole tree against the contract, at compile time and at runtime. */
export const router = os.router({
  system: systemRouter,
});

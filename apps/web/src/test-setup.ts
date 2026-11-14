import { cleanup } from "@testing-library/react";
import { afterEach } from "vite-plus/test";

// Testing Library only auto-cleans with Vitest globals, which this repo does not enable.
afterEach(cleanup);

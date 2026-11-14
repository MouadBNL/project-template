import { beforeAll } from "vite-plus/test";
import { bootTestDb } from "./testing.ts";

// Boot the worker's PGlite before the first test, under its own limit (see `bootTestDb`).
beforeAll(bootTestDb, 60_000);

import { beforeAll } from "vite-plus/test";
import { warmUpTestApp } from "./testing/test-app.ts";

// Boot the worker's PGlite and warm up the app before the first test, under their own limit:
// on a loaded machine this takes seconds, which must not count against the first test's 5 s.
beforeAll(warmUpTestApp, 60_000);

import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    // Reuse workers across test files so each worker boots PGlite once (see src/testing.ts).
    isolate: false,
    setupFiles: ["./src/test-setup.ts"],
  },
});

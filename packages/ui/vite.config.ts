import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    // Primitives are tested in a DOM emulator: fast to start, no browser binary (docs/testing.md).
    environment: "happy-dom",
    setupFiles: ["./src/test-setup.ts"],
  },
});

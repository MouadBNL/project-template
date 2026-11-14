import path from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite-plus";

/**
 * The chunk of a feature's module: one per feature (`src/features/<name>/`), so a screen needs a
 * handful of requests, not dozens.
 */
function featureChunk(id: string): string | null {
  return /[\\/]src[\\/]features[\\/]([^\\/]+)[\\/]/.exec(id)?.[1] ?? null;
}

/** One .env at the repo root serves every app (see .env.example). */
const ENV_DIR = path.resolve(import.meta.dirname, "../..");

export default defineConfig(({ mode }) => {
  // Only the variables this config reads. A `""` prefix would load the whole environment, and
  // Vite+ fingerprints every variable a config loads: any change to the shell's environment
  // (OLDPWD, an agent's session variables) would then miss the task cache of every task that loads
  // this file (test, check, knip).
  const env = loadEnv(mode, ENV_DIR, ["API_PORT", "WEB_PORT"]);
  const apiTarget = `http://localhost:${env["API_PORT"] ?? "3001"}`;
  // The API serves oRPC on /rpc (apps/api/src/app.ts). Proxied, the browser sees one origin: no
  // CORS, and a cookie the API sets is first-party.
  const proxy = { "/rpc": { target: apiTarget } };
  const port = Number(env["WEB_PORT"] ?? "5173");

  return {
    envDir: ENV_DIR,
    plugins: [
      // Must run before the React plugin. Generates src/routeTree.gen.ts.
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    build: {
      rolldownOptions: {
        output: {
          // A few chunks of a useful size rather than dozens of small ones: each is a request,
          // and with HTTP/1.1 at most six run at once. What the first load needs in two chunks,
          // libraries and app; the rest by feature, the libraries only lazy code uses in one.
          codeSplitting: {
            groups: [
              { name: "vendor", test: /node_modules/, tags: ["$initial"], priority: 4 },
              { name: "app", tags: ["$initial"], priority: 3 },
              { name: "vendor-lazy", test: /node_modules/, priority: 2 },
              { name: featureChunk, test: /[\\/]src[\\/]features[\\/]/, priority: 1 },
            ],
          },
        },
      },
    },
    server: { port, strictPort: true, proxy },
    preview: { port, strictPort: true, proxy },
    test: {
      // Pure logic (model/, *.test.ts) runs in plain Node; components and hooks (*.test.tsx) in
      // happy-dom, a DOM emulator that starts in milliseconds. See docs/testing.md.
      projects: [
        { extends: true, test: { name: "unit", include: ["src/**/*.test.ts"] } },
        {
          extends: true,
          test: {
            name: "dom",
            include: ["src/**/*.test.tsx"],
            environment: "happy-dom",
            setupFiles: ["./src/test-setup.ts"],
          },
        },
      ],
    },
  };
});

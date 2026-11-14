import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyThemePreference } from "./features/theme/index.ts";
import { createQueryClient } from "./lib/query-client.ts";
import { createAppRouter } from "./router.tsx";
import "./styles.css";

// Before the first render, so a pinned theme never flashes the OS one.
applyThemePreference();

const router = createAppRouter(createQueryClient());
const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

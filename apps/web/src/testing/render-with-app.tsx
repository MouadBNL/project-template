import { render } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppProviders } from "../lib/app-providers.tsx";
import { createQueryClient } from "../lib/query-client.ts";

/**
 * Renders `ui` with what app components expect around them: a router (memory history, so
 * `useRouter` and `<Link>` work) and a fresh QueryClient. Returns the router so a test can assert
 * where a component navigated.
 */
export async function renderWithApp(ui: ReactNode) {
  const queryClient = createQueryClient();
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory(),
  });
  await router.load();
  const result = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, router, queryClient };
}

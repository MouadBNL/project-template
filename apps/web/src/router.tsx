import type { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { AppProviders } from "./lib/app-providers.tsx";
import { routeTree } from "./routeTree.gen.ts";

export type RouterContext = { readonly queryClient: QueryClient };

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    Wrap: ({ children }) => <AppProviders queryClient={queryClient}>{children}</AppProviders>,
    // Feels instant: start a route's loader and code chunk as soon as the pointer rests on (or
    // focus reaches) a link to it, so the click finds everything ready.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    // TanStack Query owns freshness; the router must not serve its own 30s preload cache.
    defaultPreloadStaleTime: 0,
    // Show a route's pending UI only if it takes longer than this, and then for at least
    // `defaultPendingMinMs`, so fast navigations never flash a skeleton.
    defaultPendingMs: 500,
    defaultPendingMinMs: 300,
    scrollRestoration: true,
    defaultStructuralSharing: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

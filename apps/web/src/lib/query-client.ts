import { QueryClient } from "@tanstack/react-query";

/**
 * One QueryClient per app, shared with the router through its context so loaders can fill the
 * cache before a route renders.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data shown on screen stays put for 30s: switching back and forth between routes reads
        // the cache instead of refetching. Loaders and focus still refresh anything older.
        staleTime: 30_000,
        retry: 1,
      },
    },
  });
}

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

export type AppProvidersProps = { queryClient: QueryClient; children: ReactNode };

/** App-wide React context, mounted around the router (router.tsx `Wrap`). */
export function AppProviders({ queryClient, children }: AppProvidersProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

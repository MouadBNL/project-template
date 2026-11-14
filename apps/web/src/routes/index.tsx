import { createFileRoute } from "@tanstack/react-router";
import { healthQuery, SystemStatus } from "../features/system/index.ts";
import { ThemePicker } from "../features/theme/index.ts";

/** `/`: whether the API is up, and the theme. Routes compose features; they hold no logic. */
export const Route = createFileRoute("/")({
  // Starts the request on hover or navigation without holding the render: the page shows a
  // skeleton until it answers.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(healthQuery);
  },
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">App</h1>
      <SystemStatus />
      <ThemePicker />
    </main>
  );
}

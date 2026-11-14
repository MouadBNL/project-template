import { Button, Skeleton } from "@app/ui";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, CircleCheck } from "lucide-react";
import { healthQuery } from "../api/health.ts";
import { describeHealthFailure } from "../model/health.ts";

/**
 * Whether the API is up. The route loader starts the request, so this usually renders with data;
 * otherwise a skeleton holds the row's shape. Failures are values on the query.
 */
export function SystemStatus() {
  const health = useQuery(healthQuery);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="system-status">
      <h2 id="system-status" className="text-lg font-medium">
        System status
      </h2>
      <output className="flex h-8 items-center gap-2.5">
        {health.isPending ? (
          <>
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-3 w-48" />
          </>
        ) : health.isError ? (
          <>
            <CircleAlert aria-hidden className="size-4 text-danger" />
            <span>{describeHealthFailure(health.error)}</span>
          </>
        ) : (
          <>
            <CircleCheck aria-hidden className="size-4 text-success" />
            <span>The API is healthy.</span>
            <time
              className="ml-auto text-sm text-fg-subtle"
              dateTime={health.data.serverTime.toISOString()}
            >
              Server time {health.data.serverTime.toLocaleTimeString()}
            </time>
          </>
        )}
      </output>
      <Button
        className="self-start"
        pending={health.isFetching}
        onClick={() => void health.refetch()}
      >
        Check again
      </Button>
    </section>
  );
}

import { tryQuery, type Db, type QueryFailure } from "@app/db";
import type { Result } from "@app/result";
import { sql } from "drizzle-orm";

/** One round trip to the database: `ok` when it answers, its failure as a value when it does not. */
export async function pingDatabase(db: Db): Promise<Result<unknown, QueryFailure>> {
  return tryQuery(() => db.execute(sql`select 1`));
}

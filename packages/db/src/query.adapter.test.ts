import { sql } from "drizzle-orm";
import { integer, pgTable, text, type AnyPgColumn } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { Db } from "./client.adapter.ts";
import { tryQuery } from "./query.adapter.ts";
import { createTestDb, unreachableDb } from "./testing.ts";

/**
 * A table of the test's own, with one constraint of each kind (created in SQL below, where the
 * constraints are named). The template's schema has no tables; `createTestDb()` empties this one
 * like any other.
 */
const probes = pgTable("probes", {
  id: integer().primaryKey(),
  parentId: integer("parent_id").references((): AnyPgColumn => probes.id),
  name: text().notNull(),
  size: integer(),
});

const CREATE_PROBES = sql`create table if not exists probes (
  id integer primary key,
  parent_id integer constraint probes_parent_fk references probes (id),
  name text not null,
  size integer constraint probes_size_check check (size >= 0)
)`;

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
  await db.execute(CREATE_PROBES);
});

describe("tryQuery", () => {
  it("returns the query's value when nothing fails", async () => {
    const inserted = await tryQuery(() =>
      db.insert(probes).values({ id: 1, name: "a" }).returning({ id: probes.id }),
    );
    expect(inserted).toEqual({ ok: true, value: [{ id: 1 }] });
  });

  it("turns a unique violation into an Err naming the constraint and table", async () => {
    await db.insert(probes).values({ id: 1, name: "a" });
    const duplicate = await tryQuery(() => db.insert(probes).values({ id: 1, name: "b" }));
    expect(duplicate).toMatchObject({
      ok: false,
      error: { type: "unique_violation", constraint: "probes_pkey", table: "probes" },
    });
  });

  it("turns a foreign key violation into an Err", async () => {
    const orphan = await tryQuery(() =>
      db.insert(probes).values({ id: 1, parentId: 99, name: "a" }),
    );
    expect(orphan).toMatchObject({
      ok: false,
      error: { type: "foreign_key_violation", constraint: "probes_parent_fk" },
    });
  });

  it("turns a check violation into an Err", async () => {
    const negative = await tryQuery(() => db.insert(probes).values({ id: 1, name: "a", size: -1 }));
    expect(negative).toMatchObject({
      ok: false,
      error: { type: "check_violation", constraint: "probes_size_check" },
    });
  });

  it("names the column of a not-null violation", async () => {
    const unnamed = await tryQuery(() => db.execute(sql`insert into probes (id) values (1)`));
    expect(unnamed).toMatchObject({
      ok: false,
      error: { type: "not_null_violation", constraint: "name" },
    });
  });

  it("turns a database that refuses connections into db_unavailable", async () => {
    const pinged = await tryQuery(() => unreachableDb().execute(sql`select 1`));
    expect(pinged).toMatchObject({ ok: false, error: { type: "db_unavailable" } });
  });

  it("rethrows anything else (a defect)", async () => {
    await expect(tryQuery(() => db.execute(sql`select * from no_such_table`))).rejects.toThrow(
      /no_such_table/,
    );
  });
});

describe("createTestDb", () => {
  it("returns an empty database each time, in well under 100 ms", async () => {
    await db.insert(probes).values([
      { id: 1, name: "parent" },
      { id: 2, parentId: 1, name: "child" },
    ]);
    const runs = 20;
    const start = performance.now();
    for (let i = 0; i < runs; i++) await createTestDb();
    const perDatabase = (performance.now() - start) / runs;
    const fresh = await createTestDb();
    expect(await fresh.select().from(probes)).toEqual([]);
    expect(perDatabase).toBeLessThan(100);
  });
});

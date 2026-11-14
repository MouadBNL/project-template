/**
 * On-disk cache of a migrated PGlite data directory, for the test harness.
 * Booting PGlite from scratch runs initdb inside WASM (~2.5 s); loading a
 * snapshot takes ~0.4 s. The cache lives in the OS temp dir, keyed by the
 * migration files and the PGlite version, so a new migration invalidates it.
 *
 * An adapter because the filesystem throws (a missing file is ENOENT); every
 * failure here just means "no snapshot", and the caller boots from scratch.
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MIGRATIONS_FOLDER } from "./client.adapter.ts";

const CACHE_DIR = path.join(tmpdir(), "app-db-test-snapshots");

async function cacheKey(): Promise<string> {
  const hash = createHash("sha256");
  // The resolved path names the installed version (pnpm store), so an upgrade invalidates the cache.
  hash.update(import.meta.resolve("@electric-sql/pglite"));
  const files = await readdir(MIGRATIONS_FOLDER, { recursive: true, withFileTypes: true });
  const paths = files
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .toSorted();
  for (const file of paths) {
    hash.update(path.relative(MIGRATIONS_FOLDER, file));
    hash.update(await readFile(file));
  }
  return hash.digest("hex").slice(0, 16);
}

const snapshotPath = (key: string): string => path.join(CACHE_DIR, `${key}.tar`);

/** The cached snapshot for the current migrations, or `undefined`. */
export async function readSnapshot(): Promise<Blob | undefined> {
  try {
    return new Blob([await readFile(snapshotPath(await cacheKey()))]);
  } catch {
    return undefined;
  }
}

/** Stores a snapshot (atomically, so parallel workers never read half a file) and prunes stale ones. */
export async function writeSnapshot(snapshot: Blob): Promise<void> {
  try {
    const key = await cacheKey();
    await mkdir(CACHE_DIR, { recursive: true });
    const partial = `${snapshotPath(key)}.${process.pid}.partial`;
    await writeFile(partial, new Uint8Array(await snapshot.arrayBuffer()));
    await rename(partial, snapshotPath(key));
    for (const file of await readdir(CACHE_DIR)) {
      if (file !== `${key}.tar` && !file.endsWith(".partial")) {
        await rm(path.join(CACHE_DIR, file), { force: true });
      }
    }
  } catch {
    // A missing cache only costs time.
  }
}

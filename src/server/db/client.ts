import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

/**
 * Any Postgres-backed Drizzle database with our schema
 * (postgres-js in runtime, PGlite in tests). Services receive this type
 * so they can be tested without a real Postgres server.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Db };

export function getDb(): Db {
  if (!globalForDb.__db) {
    const client = postgres(env().DATABASE_URL, { max: 10, prepare: false });
    globalForDb.__db = drizzle(client, { schema }) as unknown as Db;
  }
  return globalForDb.__db;
}

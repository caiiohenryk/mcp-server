import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import type { Db } from "@/server/db/client";
import * as schema from "@/server/db/schema";

/** Fresh in-memory Postgres with all migrations applied. One per test file/suite. */
export async function createTestDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  return db as unknown as Db;
}

/** Inserts an allowed user + Auth.js user row and returns the user id. */
export async function seedUser(
  db: Db,
  email = "dev@example.com",
  role: "admin" | "member" = "member",
): Promise<string> {
  await db.insert(schema.allowedUsers).values({ email, role }).onConflictDoNothing();
  const [u] = await db
    .insert(schema.users)
    .values({ email, name: email.split("@")[0] })
    .returning();
  return u!.id;
}

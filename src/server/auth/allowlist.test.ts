import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { allowedUsers, sessions } from "@/server/db/schema";
import { createTestDb, seedUser } from "@/test/db";
import {
  addAllowedUser,
  AllowlistError,
  deactivateAllowedUser,
  getActiveAllowedUser,
  setAllowedUserRole,
} from "./allowlist";

describe("allowlist", () => {
  let db: Db;
  let admin: { userId: string; email: string };

  beforeEach(async () => {
    db = await createTestDb();
    admin = { userId: await seedUser(db, "lead@example.com", "admin"), email: "lead@example.com" };
  });

  it("rejects emails that are not on the allowlist", async () => {
    expect(await getActiveAllowedUser(db, "stranger@example.com")).toBeNull();
    expect(await getActiveAllowedUser(db, "not-an-email")).toBeNull();
  });

  it("bootstraps ADMIN_EMAILS as admins, case-insensitively", async () => {
    const row = await getActiveAllowedUser(db, "Admin@Example.com");
    expect(row).toMatchObject({ email: "admin@example.com", role: "admin", active: true });
  });

  it("adds, re-activates and changes role", async () => {
    await addAllowedUser(db, admin, { email: "New@Example.com", role: "member" });
    expect(await getActiveAllowedUser(db, "new@example.com")).toMatchObject({ role: "member" });

    await setAllowedUserRole(db, admin, "new@example.com", "admin");
    expect(await getActiveAllowedUser(db, "new@example.com")).toMatchObject({ role: "admin" });

    await db
      .update(allowedUsers)
      .set({ active: false })
      .where(eq(allowedUsers.email, "new@example.com"));
    expect(await getActiveAllowedUser(db, "new@example.com")).toBeNull();
    await addAllowedUser(db, admin, { email: "new@example.com", role: "member" });
    expect(await getActiveAllowedUser(db, "new@example.com")).toMatchObject({ active: true });
  });

  it("deactivating a user deletes their sessions", async () => {
    const userId = await seedUser(db, "dev@example.com");
    await db
      .insert(sessions)
      .values({ sessionToken: "s1", userId, expires: new Date(Date.now() + 60_000) });
    await deactivateAllowedUser(db, admin, "dev@example.com");
    expect(await getActiveAllowedUser(db, "dev@example.com")).toBeNull();
    expect(await db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
  });

  it("prevents admins from demoting or removing themselves", async () => {
    await expect(setAllowedUserRole(db, admin, admin.email, "member")).rejects.toMatchObject({
      code: "self_demotion",
    });
    await expect(deactivateAllowedUser(db, admin, admin.email)).rejects.toBeInstanceOf(
      AllowlistError,
    );
  });
});

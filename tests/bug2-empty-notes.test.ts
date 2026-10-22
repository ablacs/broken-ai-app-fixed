import { describe, expect, it } from "vitest";
import { actAs, createTestDatabase, seedTwoUsersWithNotes, USER_A } from "./helpers/db";

describe("Bug 2: the notes list is always empty", () => {
  it("returns the signed-in user's notes and nobody else's", async () => {
    const db = await createTestDatabase();
    await seedTwoUsersWithNotes(db);

    await actAs(db, "authenticated", USER_A);
    const { rows } = await db.query<{ body: string }>("select body from public.notes order by body");

    expect(rows.map((r) => r.body)).toEqual(["A: first", "A: second"]);
  });

  it("counts the user's notes, so the free-plan limit is enforced", async () => {
    const db = await createTestDatabase();
    await seedTwoUsersWithNotes(db);

    await actAs(db, "authenticated", USER_A);
    // Same count the addNote server action uses to enforce the free limit.
    const { rows } = await db.query<{ count: number }>("select count(*)::int as count from public.notes");

    expect(rows[0].count).toBe(2);
  });
});

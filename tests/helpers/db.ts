import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The parts of Supabase that the migrations depend on: the auth schema,
// auth.uid(), and the three API roles. service_role bypasses RLS like it
// does on Supabase.
const SUPABASE_SHIM = `
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
  $$;
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

const GRANTS = `
  grant all on all tables in schema public to anon, authenticated, service_role;
`;

export async function createTestDatabase() {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);

  const dir = join(__dirname, "..", "..", "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }

  await db.exec(GRANTS);
  return db;
}

// Runs queries as a Supabase API role, optionally as a signed-in user.
export async function actAs(
  db: PGlite,
  role: "anon" | "authenticated" | "service_role",
  userId?: string,
) {
  await db.exec("reset role");
  const claims = userId ? JSON.stringify({ sub: userId, role }) : "";
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims]);
  await db.exec(`set role ${role}`);
}

export const USER_A = "11111111-1111-1111-1111-111111111111";
export const USER_B = "22222222-2222-2222-2222-222222222222";

export async function seedTwoUsersWithNotes(db: PGlite) {
  await db.exec("reset role");
  await db.query("insert into auth.users (id, email) values ($1, 'a@example.com'), ($2, 'b@example.com')", [
    USER_A,
    USER_B,
  ]);
  await db.query(
    "insert into public.notes (user_id, body) values ($1, 'A: first'), ($1, 'A: second'), ($2, 'B: private')",
    [USER_A, USER_B],
  );
}

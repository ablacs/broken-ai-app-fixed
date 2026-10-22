import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { FREE_NOTE_LIMIT } from "../../lib/plan";
import { addNote } from "./actions";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: notes }] = await Promise.all([
    supabase.from("profiles").select("is_pro").eq("id", user.id).single(),
    supabase.from("notes").select("id, body, created_at").order("created_at", { ascending: false }),
  ]);

  const isPro = profile?.is_pro ?? false;
  const noteList = notes ?? [];
  const atLimit = !isPro && noteList.length >= FREE_NOTE_LIMIT;
  const { upgraded } = await searchParams;

  return (
    <>
      <h1>Your notes</h1>
      <p>
        {user.email} · {isPro ? "Pro plan" : `Free plan (${noteList.length}/${FREE_NOTE_LIMIT} notes)`}
      </p>
      {upgraded && !isPro && <p>Payment received. Pro will unlock in a few seconds; refresh the page.</p>}

      {atLimit ? (
        <form action="/api/checkout" method="post">
          <p>You reached the free limit.</p>
          <button type="submit">Upgrade to Pro</button>
        </form>
      ) : (
        <form action={addNote}>
          <label htmlFor="body">New note</label>
          <textarea id="body" name="body" required maxLength={500} rows={3} />
          <button type="submit">Save note</button>
        </form>
      )}

      <ul className="notes">
        {noteList.map((note) => (
          <li key={note.id}>{note.body}</li>
        ))}
      </ul>
      {noteList.length === 0 && <p>No notes yet.</p>}
    </>
  );
}

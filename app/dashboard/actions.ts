"use server";

import { revalidatePath } from "next/cache";
import { FREE_NOTE_LIMIT } from "../../lib/plan";
import { createSupabaseServerClient } from "../../lib/supabase/server";

export async function addNote(formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // The form hides itself at the limit, but the server enforces it too.
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("is_pro").eq("id", user.id).single(),
    supabase.from("notes").select("id", { count: "exact", head: true }),
  ]);
  if (!profile?.is_pro && (count ?? 0) >= FREE_NOTE_LIMIT) {
    throw new Error("Free plan limit reached");
  }

  const { error } = await supabase.from("notes").insert({ body });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

import { createClient } from "@supabase/supabase-js";

// Gives the user the Pro plan after a successful payment.
export async function markUserPro(
  userId: string,
  stripeCustomerId: string | null,
  fetchImpl?: typeof fetch,
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      ...(fetchImpl ? { global: { fetch: fetchImpl } } : {}),
    },
  );

  const { error } = await supabase
    .from("profiles")
    .update({ is_pro: true, stripe_customer_id: stripeCustomerId })
    .eq("id", userId);

  if (error) throw error;
}

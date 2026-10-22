import { createSupabaseAdminClient } from "./supabase/admin";

// Gives the user the Pro plan after a successful payment.
// Runs from the Stripe webhook, where there is no signed-in user, so it uses
// the service role. Users have no RLS policy to update their own plan.
export async function markUserPro(
  userId: string,
  stripeCustomerId: string | null,
  fetchImpl?: typeof fetch,
) {
  const supabase = createSupabaseAdminClient(fetchImpl);

  const { data, error } = await supabase
    .from("profiles")
    .update({ is_pro: true, stripe_customer_id: stripeCustomerId })
    .eq("id", userId)
    .select("id");

  if (error) throw error;
  // An update that matches no row is not an error in Postgres. Fail loudly
  // so Stripe retries the webhook and the problem shows up in the logs.
  if (!data || data.length === 0) {
    throw new Error(`No profile found for user ${userId}`);
  }
}

import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only client with the service role key. It bypasses RLS, so use it
// only for trusted server work such as Stripe webhooks, never in the browser.
export function createSupabaseAdminClient(fetchImpl?: typeof fetch) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      ...(fetchImpl ? { global: { fetch: fetchImpl } } : {}),
    },
  );
}

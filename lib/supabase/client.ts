import { createClient } from "@supabase/supabase-js";

// Supabase client for Client Components (the login form).
export function createSupabaseBrowserClient(fetchImpl?: typeof fetch) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    fetchImpl ? { global: { fetch: fetchImpl } } : undefined,
  );
}

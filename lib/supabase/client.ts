import { createBrowserClient } from "@supabase/ssr";

// Supabase client for Client Components (the login form).
// createBrowserClient keeps the session in cookies, so the middleware and
// Server Components see the same signed-in user as the browser.
export function createSupabaseBrowserClient(fetchImpl?: typeof fetch) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    fetchImpl ? { global: { fetch: fetchImpl } } : undefined,
  );
}

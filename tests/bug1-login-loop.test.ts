// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

const PROJECT_REF = "abcdefghijklmnopqrst";
process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

function fakeJwt(sub: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub, exp, role: "authenticated" })}.signature`;
}

// What Supabase Auth returns for a successful email + password sign-in.
function signInResponse() {
  const user = {
    id: "11111111-1111-1111-1111-111111111111",
    aud: "authenticated",
    role: "authenticated",
    email: "a@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  return {
    access_token: fakeJwt(user.id),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "test-refresh-token",
    user,
  };
}

describe("Bug 1: logging in sends the user back to /login", () => {
  it("stores the session in a cookie, where the middleware can read it", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(signInResponse()), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const { createSupabaseBrowserClient } = await import("../lib/supabase/client");
    const supabase = createSupabaseBrowserClient(fetchMock as unknown as typeof fetch);

    const { error } = await supabase.auth.signInWithPassword({
      email: "a@example.com",
      password: "correct-password",
    });

    expect(error).toBeNull();
    // The middleware only sees cookies. A session kept in localStorage is
    // invisible to it, so every visit to /dashboard redirects to /login.
    expect(document.cookie).toContain(`sb-${PROJECT_REF}-auth-token`);
  });
});

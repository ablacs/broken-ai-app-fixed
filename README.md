# Broken AI app → fixed

Notely is a small notes app built with Next.js, Supabase and Stripe. Free users can write 3 notes. Paying $9 in Stripe test mode unlocks Pro.

The first commit is the app the way AI app builders often leave it: it looks finished, then breaks once real users log in and pay. It has three bugs that keep showing up in apps made with Lovable, Bolt, Cursor and similar tools. Each later commit fixes one bug and explains why it happened. Each bug has a test that fails before its fix and passes after.

| | Symptom the owner reports | Cause | Fix commit |
|---|---|---|---|
| 1 | "I log in and it sends me back to the login page." | Session stored in localStorage; the server only reads cookies | `6283b4a` |
| 2 | "My notes saved, but the list is always empty." | Row Level Security policy compares the wrong column | `1a9f604` |
| 3 | "Stripe charged the card, but the user is still on the free plan." | Webhook signature checked against re-serialized JSON, and the update ran with the anon key | `45166c5` |

```bash
git checkout broken   # the app before the fixes: 5 of 7 tests fail
git checkout main     # after the fixes: 7 of 7 pass
npm test
```

---

## Bug 1: logging in sends you back to /login

**What the owner sees.** The login form says nothing is wrong. The page goes to `/dashboard` and immediately back to `/login`.

**Why.** The login form created its Supabase client with `createClient` from `@supabase/supabase-js`. In the browser, that client saves the session in `localStorage`. The middleware that protects `/dashboard` runs on the server and can only read cookies. It never finds a session, so it redirects every request to `/login`.

**Fix.** Use `createBrowserClient` from `@supabase/ssr`, which saves the session in cookies. The browser, middleware and Server Components now share the same signed-in user.

```diff
- import { createClient } from "@supabase/supabase-js";
+ import { createBrowserClient } from "@supabase/ssr";

  export function createSupabaseBrowserClient(fetchImpl?: typeof fetch) {
-   return createClient(
+   return createBrowserClient(
```

**Test.** [`tests/bug1-login-loop.test.ts`](tests/bug1-login-loop.test.ts) signs in against a mocked Supabase Auth response in a simulated browser and checks that the session cookie exists.

---

## Bug 2: the notes list is always empty

**What the owner sees.** Adding a note works. The list never shows anything. There are no errors in the console or the logs. The free-plan limit also never triggers: the app counts the user's notes with the same query, always gets 0, and lets free users add unlimited notes.

**Why.** The Row Level Security policy for reading notes was:

```sql
using (auth.uid() = id)   -- the note's own id, never the user's id
```

A note's `id` is never equal to the user's id, so Postgres filters out every row. RLS does not raise an error when it hides rows; the query returns an empty list.

**Fix.** A new migration, [`002_fix_notes_read_policy.sql`](supabase/migrations/002_fix_notes_read_policy.sql), replaces the policy with one that compares the owner column. Editing `001` would not reach a database that already ran it.

```sql
using (auth.uid() = user_id)
```

**Test.** [`tests/bug2-empty-notes.test.ts`](tests/bug2-empty-notes.test.ts) runs the real migrations in an in-memory Postgres ([PGlite](https://pglite.dev)) with Supabase's roles and `auth.uid()`. It checks that user A sees exactly their 2 notes, not user B's.

---

## Bug 3: the card is charged but the user stays on the free plan

**What the owner sees.** Stripe shows a successful payment. The user's account still says "Free plan". The Stripe dashboard shows the webhook failing with 400.

**Why.** Two separate problems, each enough to break it:

1. **Signature check on the wrong bytes.** The webhook read the body with `request.json()` and passed `JSON.stringify(body)` to `constructEvent`. Stripe signs the exact bytes it sends. Re-serializing removes the whitespace, so the signature never matches and every event is rejected.
2. **Update with the anon key.** After the signature passed, the profile update would still have used the public anon key. There is (on purpose) no RLS policy that lets anyone update `is_pro`, so Postgres updates zero rows and returns no error.

**Fix.**

```diff
- const body = await request.json();
- event = stripe.webhooks.constructEvent(JSON.stringify(body), signature, secret);
+ const rawBody = await request.text();
+ event = stripe.webhooks.constructEvent(rawBody, signature, secret);
```

`markUserPro` now uses a server-only client with the service role key ([`lib/supabase/admin.ts`](lib/supabase/admin.ts)), protected by `import "server-only"` so it can't end up in the browser bundle. It also throws when no row was updated, so Stripe retries the webhook and the problem shows in the logs.

**Test.** [`tests/bug3-paid-but-not-pro.test.ts`](tests/bug3-paid-but-not-pro.test.ts) signs a `checkout.session.completed` event the way Stripe does and checks that the webhook accepts it and unlocks Pro. It rejects a tampered payload, sends the service role key to Supabase, and shows in Postgres that the anon key updates 0 rows while the service role updates 1.

---

## How I approach these bugs

1. Reproduce the bug on a separate branch before changing anything.
2. Find the cause and explain it to the owner in plain language.
3. Write a test that fails because of the bug, then fix it.
4. Leave a note, and when it helps, a rule in the project's AI instructions, so the next prompt doesn't bring the bug back.

---

## Run it yourself

Requirements: Node 20+, a Supabase project, a Stripe account in test mode and the [Stripe CLI](https://docs.stripe.com/stripe-cli).

```bash
npm install
cp .env.example .env.local      # fill in the keys
# Run supabase/migrations/*.sql in order in the Supabase SQL editor
stripe listen --forward-to localhost:3000/api/stripe/webhook   # prints STRIPE_WEBHOOK_SECRET
npm run dev
```

Pay with the test card `4242 4242 4242 4242`, any future date and any CVC.

The tests need no accounts or keys:

```bash
npm test
```

## Stack

Next.js 15 (App Router), React 19, Supabase (`@supabase/ssr`, Postgres RLS), Stripe Checkout and webhooks, Vitest, PGlite.

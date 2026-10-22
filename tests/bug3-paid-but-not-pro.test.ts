import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { markUserPro } from "../lib/billing";
import { handleStripeWebhook } from "../lib/stripe/webhook";
import { actAs, createTestDatabase, seedTwoUsersWithNotes, USER_A } from "./helpers/db";

const WEBHOOK_SECRET = "whsec_test_secret";
const stripe = new Stripe("sk_test_placeholder");

// Stripe sends the event pretty-printed. The signature covers these exact bytes.
function checkoutCompletedPayload(userId: string) {
  return JSON.stringify(
    {
      id: "evt_test_1",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          object: "checkout.session",
          client_reference_id: userId,
          customer: "cus_test_1",
          payment_status: "paid",
        },
      },
    },
    null,
    2,
  );
}

function signedRequest(payload: string) {
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature, "content-type": "application/json" },
    body: payload,
  });
}

describe("Bug 3: the card is charged but the user stays on the free plan", () => {
  it("accepts a correctly signed Stripe event and unlocks Pro", async () => {
    const unlock = vi.fn(async () => {});
    const response = await handleStripeWebhook(signedRequest(checkoutCompletedPayload(USER_A)), {
      stripe,
      webhookSecret: WEBHOOK_SECRET,
      markUserPro: unlock,
    });

    expect(response.status).toBe(200);
    expect(unlock).toHaveBeenCalledWith(USER_A, "cus_test_1");
  });

  it("rejects an event whose signature does not match", async () => {
    const request = signedRequest(checkoutCompletedPayload(USER_A));
    const tampered = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: checkoutCompletedPayload("someone-else"),
    });
    const unlock = vi.fn(async () => {});

    const response = await handleStripeWebhook(tampered, { stripe, webhookSecret: WEBHOOK_SECRET, markUserPro: unlock });

    expect(response.status).toBe(400);
    expect(unlock).not.toHaveBeenCalled();
  });

  it("updates the profile with the service role key, which RLS allows", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify([{ id: USER_A }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    await markUserPro(USER_A, "cus_test_1", fetchMock as unknown as typeof fetch);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("apikey")).toBe("test-service-role-key");
  });

  it("shows why: with the anon key, RLS silently updates zero rows", async () => {
    const db = await createTestDatabase();
    await seedTwoUsersWithNotes(db);
    const update = "update public.profiles set is_pro = true where id = $1";

    await actAs(db, "anon");
    const asAnon = await db.query(update, [USER_A]);

    await actAs(db, "service_role");
    const asServiceRole = await db.query(update, [USER_A]);

    expect(asAnon.affectedRows).toBe(0);
    expect(asServiceRole.affectedRows).toBe(1);
  });
});

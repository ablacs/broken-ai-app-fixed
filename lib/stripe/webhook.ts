import type Stripe from "stripe";
import { markUserPro } from "../billing";
import { getStripe } from "./client";

type Deps = {
  stripe: Stripe;
  webhookSecret: string;
  markUserPro: (userId: string, stripeCustomerId: string | null) => Promise<void>;
};

function defaultDeps(): Deps {
  return {
    stripe: getStripe(),
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    markUserPro: (userId, customerId) => markUserPro(userId, customerId),
  };
}

// Verifies a Stripe webhook request and unlocks Pro when a checkout completes.
export async function handleStripeWebhook(request: Request, deps: Deps = defaultDeps()) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  // Stripe signs the exact bytes it sent. Parsing the JSON and serializing it
  // again changes whitespace, and the signature no longer matches.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = deps.stripe.webhooks.constructEvent(rawBody, signature, deps.webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (!session.client_reference_id) {
      return new Response("Checkout session has no client_reference_id", { status: 400 });
    }
    const customerId = typeof session.customer === "string" ? session.customer : null;
    await deps.markUserPro(session.client_reference_id, customerId);
  }

  return new Response("ok", { status: 200 });
}

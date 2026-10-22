import { handleStripeWebhook } from "../../../../lib/stripe/webhook";

export async function POST(request: Request) {
  return handleStripeWebhook(request);
}

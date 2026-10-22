import { NextResponse } from "next/server";
import { getStripe } from "../../../lib/stripe/client";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

// Starts a Stripe Checkout (test mode) for the one-time Pro upgrade.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const origin = new URL(request.url).origin;

  if (!user) {
    return NextResponse.redirect(`${origin}/login`, 303);
  }

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    client_reference_id: user.id,
    customer_email: user.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 900,
          product_data: { name: "Notely Pro (lifetime)" },
        },
      },
    ],
    success_url: `${origin}/dashboard?upgraded=1`,
    cancel_url: `${origin}/dashboard`,
  });

  return NextResponse.redirect(session.url!, 303);
}

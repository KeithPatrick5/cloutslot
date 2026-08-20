import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid webhook." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === "paid") {
      const checkoutId = session.metadata?.checkout_id || session.client_reference_id;
      const amount = Number(session.amount_total ?? 0);
      if (!checkoutId || amount < 1) return NextResponse.json({ error: "Missing checkout reconciliation data." }, { status: 400 });

      const supabase = getAdminClient();
      if (!supabase) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

      const { error } = await supabase.rpc("complete_bid_payment", {
        p_checkout_id: checkoutId,
        p_provider: "stripe",
        p_provider_payment_id: session.id,
        p_amount_cents: amount,
      });
      if (error) return NextResponse.json({ error: "Database update failed." }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

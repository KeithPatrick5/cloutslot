import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminClient, hasLiveDatabase } from "@/lib/supabase";
import { normalizeUrl } from "@/lib/data";
import { minimumChargeCents } from "@/lib/bids";
import { availablePaymentProviders, nowPaymentsBaseUrl, type PaymentProvider } from "@/lib/payments";

export const runtime = "nodejs";

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function centsToDollars(cents: number) {
  return Number((cents / 100).toFixed(2));
}

export async function POST(request: Request) {
  let checkoutId: string | null = null;

  try {
    if (!hasLiveDatabase()) {
      return NextResponse.json({ error: "The leaderboard database is unavailable." }, { status: 503 });
    }

    const body = await request.json();
    const provider = clean(body.provider, 20) as PaymentProvider;
    const enabled = availablePaymentProviders();
    if (!enabled.includes(provider)) {
      return NextResponse.json({ error: `${provider || "That payment method"} is not configured.` }, { status: 503 });
    }

    const submittedName = clean(body.name, 60);
    const submittedTagline = clean(body.tagline, 120);
    const rawUrl = clean(body.url, 500);
    const rawLogo = clean(body.logoUrl, 500);
    const targetDollars = Number(body.targetBidDollars);

    if (!submittedName || !submittedTagline || !rawUrl || !Number.isFinite(targetDollars)) {
      return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
    }

    const normalizedUrl = normalizeUrl(rawUrl);
    const urlKey = normalizedUrl.toLowerCase();
    const targetBidCents = Math.round(targetDollars * 100);
    const minimumCharge = minimumChargeCents(provider);
    if (targetBidCents < minimumCharge) {
      const minimum = centsToDollars(minimumCharge).toFixed(2);
      return NextResponse.json(
        { error: `${provider === "stripe" ? "Card" : "Crypto"} payments require at least $${minimum}.` },
        { status: 400 },
      );
    }

    let submittedLogoUrl = "";
    if (rawLogo) submittedLogoUrl = normalizeUrl(rawLogo);

    const supabase = getAdminClient()!;
    const { data: existing, error: lookupError } = await supabase
      .from("listings")
      .select("id,name,tagline,url,logo_url,bid_cents")
      .eq("url_key", urlKey)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const currentBid = Number(existing?.bid_cents ?? 0);
    const amountToCharge = targetBidCents - currentBid;
    if (amountToCharge < minimumCharge) {
      return NextResponse.json(
        {
          error: `That URL is already at $${(currentBid / 100).toFixed(2)}. Raise the total by at least $${centsToDollars(minimumCharge).toFixed(2)} for this payment method.`,
        },
        { status: 400 },
      );
    }

    // Re-bidding an existing URL can increase its score, but it cannot silently
    // rewrite the listing identity. That prevents a bidder from paying $1 to
    // hijack another project's name, pitch, or logo.
    const name = existing?.name ?? submittedName;
    const tagline = existing?.tagline ?? submittedTagline;
    const listingUrl = existing?.url ?? normalizedUrl;
    const logoUrl = existing?.logo_url ?? (submittedLogoUrl || null);

    checkoutId = crypto.randomUUID();
    const listingId = existing?.id ?? crypto.randomUUID();
    const { error: intentError } = await supabase.from("payment_intents").insert({
      id: checkoutId,
      provider,
      listing_id: listingId,
      name,
      tagline,
      url: listingUrl,
      url_key: urlKey,
      logo_url: logoUrl,
      amount_cents: amountToCharge,
    });
    if (intentError) throw intentError;

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");

    if (provider === "stripe") {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          client_reference_id: checkoutId,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: amountToCharge,
                product_data: {
                  name: `CloutSlot bid — ${name}`,
                  description: `Increase this listing to ${new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  }).format(targetBidCents / 100)} total.`,
                },
              },
            },
          ],
          success_url: `${siteUrl}/?paid=1&provider=stripe`,
          cancel_url: `${siteUrl}/?canceled=1`,
          metadata: { checkout_id: checkoutId },
        },
        { idempotencyKey: checkoutId },
      );

      if (!session.url) throw new Error("Stripe did not return a checkout URL.");
      return NextResponse.json({ url: session.url });
    }

    const response = await fetch(`${nowPaymentsBaseUrl()}/invoice`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.NOWPAYMENTS_API_KEY!,
      },
      body: JSON.stringify({
        price_amount: centsToDollars(amountToCharge),
        price_currency: "usd",
        order_id: checkoutId,
        order_description: `CloutSlot bid — ${name}`,
        ipn_callback_url: `${siteUrl}/api/webhooks/nowpayments`,
        success_url: `${siteUrl}/?paid=1&provider=nowpayments`,
        cancel_url: `${siteUrl}/?canceled=1`,
      }),
      cache: "no-store",
    });

    const invoice = await response.json();
    if (!response.ok) {
      throw new Error(invoice?.message || invoice?.error || "NOWPayments invoice creation failed.");
    }

    const invoiceUrl = invoice?.invoice_url || invoice?.url;
    if (!invoiceUrl) throw new Error("NOWPayments did not return an invoice URL.");

    await supabase
      .from("payment_intents")
      .update({ provider_reference: String(invoice.id ?? invoice.invoice_id ?? "") })
      .eq("id", checkoutId);

    return NextResponse.json({ url: invoiceUrl });
  } catch (error) {
    console.error(error);

    if (checkoutId) {
      try {
        const supabase = getAdminClient();
        if (supabase) {
          await supabase
            .from("payment_intents")
            .update({ status: "failed" })
            .eq("id", checkoutId)
            .eq("status", "pending");
        }
      } catch {
        // Preserve the original checkout error.
      }
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed." }, { status: 500 });
  }
}

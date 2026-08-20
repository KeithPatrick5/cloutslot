import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function deepSort(value: Json): Json {
  if (Array.isArray(value)) return value.map(deepSort);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce<Record<string, Json>>((out, key) => {
      out[key] = deepSort((value as Record<string, Json>)[key]);
      return out;
    }, {});
  }
  return value;
}

function validSignature(payload: Json, received: string, secret: string) {
  const expected = createHmac("sha512", secret).update(JSON.stringify(deepSort(payload))).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!process.env.NOWPAYMENTS_IPN_SECRET) {
    return NextResponse.json({ error: "NOWPayments IPN is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("x-nowpayments-sig") || "";
  let body: Record<string, Json>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!signature || !validSignature(body, signature, process.env.NOWPAYMENTS_IPN_SECRET)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  if (String(body.payment_status || "").toLowerCase() !== "finished") {
    return NextResponse.json({ received: true, credited: false });
  }

  const checkoutId = String(body.order_id || "");
  const providerPaymentId = String(body.payment_id || body.invoice_id || "");
  const priceAmount = Number(body.price_amount || 0);
  const priceCurrency = String(body.price_currency || "").toLowerCase();
  const amountCents = Math.round(priceAmount * 100);

  if (!checkoutId || !providerPaymentId || amountCents < 1 || priceCurrency !== "usd") {
    return NextResponse.json({ error: "Missing payment reconciliation data." }, { status: 400 });
  }

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  const { error } = await supabase.rpc("complete_bid_payment", {
    p_checkout_id: checkoutId,
    p_provider: "nowpayments",
    p_provider_payment_id: providerPaymentId,
    p_amount_cents: amountCents,
  });
  if (error) return NextResponse.json({ error: "Database update failed." }, { status: 500 });

  return NextResponse.json({ received: true, credited: true });
}

export type PaymentProvider = "stripe" | "nowpayments";

export function availablePaymentProviders(): PaymentProvider[] {
  const providers: PaymentProvider[] = [];
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) providers.push("stripe");
  if (process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET) providers.push("nowpayments");
  return providers;
}

export function nowPaymentsBaseUrl() {
  return (process.env.NOWPAYMENTS_API_BASE_URL || "https://api.nowpayments.io/v1").replace(/\/$/, "");
}

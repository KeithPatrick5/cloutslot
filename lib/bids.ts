import type { PaymentProvider } from "./payments";

export const MINIMUM_CHARGE_CENTS: Record<PaymentProvider, number> = {
  stripe: 50,
  nowpayments: 500,
};

export const MINIMUM_PUBLIC_BID_CENTS = MINIMUM_CHARGE_CENTS.stripe;
export const OUTBID_INCREMENT_CENTS = 1;

export function minimumChargeCents(provider: PaymentProvider) {
  return MINIMUM_CHARGE_CENTS[provider];
}


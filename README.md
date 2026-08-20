# CloutSlot

CloutSlot is a paid-link leaderboard for `cloutslot.space`. Every listing has a cumulative bid, higher bids rank higher, and every paid listing remains on the board unless it is moderated.

## Production features

- Leaderboard-first responsive homepage
- Live rank ordering by cumulative paid amount
- Public outbound click counts
- Stripe Checkout payments
- NOWPayments crypto invoices
- Verified Stripe webhook signatures
- Verified NOWPayments HMAC-SHA512 IPN signatures
- Supabase/Postgres persistence
- Idempotent payment reconciliation
- Existing URLs pay only the difference needed to reach a higher displayed total
- Existing listing identity cannot be overwritten by a rebid
- No fake/demo listings in production
- No user accounts required

## Database

Run `supabase/schema.sql` once in the Supabase SQL editor before accepting payments.

## Production endpoints

Stripe webhook:

```text
https://cloutslot.space/api/webhooks/stripe
```

Subscribe to:

```text
checkout.session.completed
```

NOWPayments IPN:

```text
https://cloutslot.space/api/webhooks/nowpayments
```

## Environment variables

```text
NEXT_PUBLIC_SITE_URL=https://cloutslot.space
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
NOWPAYMENTS_API_BASE_URL=https://api.nowpayments.io/v1
```

All service/API keys belong in Vercel environment variables. Never expose them in browser code or commit them to GitHub.

## Ranking behavior

If a URL is at $100 and its total bid is raised to $140, checkout charges $40. The payment webhook credits that $40 only after the provider confirms payment. The board then reorders automatically.

## Local development

```bash
npm install
npm run dev
```

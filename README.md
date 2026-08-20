# CloutSlot

**Pay more. Sit higher. Get seen.**

CloutSlot is a paid-link leaderboard. Every listing has a cumulative bid, higher bids rank higher, and everyone who has paid remains on the board.

## Included

- Responsive dark leaderboard UI
- Live rank ordering by cumulative paid amount
- Public outbound click counts
- Stripe Checkout payments
- NOWPayments crypto invoices
- Verified Stripe webhooks
- Verified NOWPayments HMAC-SHA512 IPN callbacks
- Supabase/Postgres persistence
- Provider-neutral, idempotent payment reconciliation
- Existing URLs only pay the difference needed to reach a higher displayed total
- Demo mode when the database is not configured
- No user accounts required

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## One-command payment setup

```bash
npm run setup:payments
```

The setup script asks for:

- public site URL
- Supabase project URL
- Supabase service-role key
- Stripe secret key + webhook signing secret
- NOWPayments API key + IPN secret

It writes `.env.local` with mode `600`, validates the Stripe and NOWPayments API keys when possible, and prints the two webhook URLs.

You can leave either payment provider blank and run with only the other one.

## Database setup

Run `supabase/schema.sql` once in the Supabase SQL editor. It creates the listings, payment intents, payment ledger, idempotent payment completion function, and click counter.

## Production webhook URLs

Stripe:

```text
https://YOUR_DOMAIN/api/webhooks/stripe
```

Subscribe it to `checkout.session.completed`.

NOWPayments:

```text
https://YOUR_DOMAIN/api/webhooks/nowpayments
```

Generate an IPN secret in NOWPayments and keep it in `NOWPAYMENTS_IPN_SECRET`.

NOWPayments does not deliver callbacks to localhost, so live crypto checkout should use a public HTTPS `NEXT_PUBLIC_SITE_URL`.

## Environment variables

```text
NEXT_PUBLIC_SITE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
NOWPAYMENTS_API_BASE_URL
```

Never expose `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, or NOWPayments secrets in browser code.

## Ranking behavior

If a URL is already at $100 and raises its total bid to $140, CloutSlot charges $40 through whichever provider was selected. The webhook credits the $40 only after the provider reports a completed payment.

## Moderation

Before serious public traffic, add an admin moderation path or database workflow for malware, fraud, impersonation, illegal content, and abuse. Payment buys placement, not immunity from moderation or guaranteed traffic.

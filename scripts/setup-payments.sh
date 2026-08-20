#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE=".env.local"

echo
echo "CloutSlot payment setup"
echo "This writes secrets only to $ENV_FILE (gitignored)."
echo

read -r -p "Public site URL [http://localhost:3000]: " SITE_URL
SITE_URL="${SITE_URL:-http://localhost:3000}"

read -r -p "Supabase project URL: " SUPABASE_URL
read -r -s -p "Supabase service-role key: " SUPABASE_SERVICE_ROLE_KEY; echo

read -r -s -p "Stripe secret key (leave blank to disable Stripe): " STRIPE_SECRET_KEY; echo
STRIPE_WEBHOOK_SECRET=""
if [[ -n "$STRIPE_SECRET_KEY" ]]; then
  read -r -s -p "Stripe webhook signing secret (whsec_...): " STRIPE_WEBHOOK_SECRET; echo
fi

read -r -s -p "NOWPayments API key (leave blank to disable crypto): " NOWPAYMENTS_API_KEY; echo
NOWPAYMENTS_IPN_SECRET=""
if [[ -n "$NOWPAYMENTS_API_KEY" ]]; then
  read -r -s -p "NOWPayments IPN secret: " NOWPAYMENTS_IPN_SECRET; echo
fi

cat > "$ENV_FILE" <<ENV
NEXT_PUBLIC_SITE_URL=$SITE_URL
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET
NOWPAYMENTS_API_KEY=$NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET=$NOWPAYMENTS_IPN_SECRET
NOWPAYMENTS_API_BASE_URL=https://api.nowpayments.io/v1
ENV
chmod 600 "$ENV_FILE"

echo
echo "Checking credentials..."

if [[ -n "$STRIPE_SECRET_KEY" ]]; then
  CODE=$(curl -sS -o /tmp/cloutslot-stripe-check.json -w '%{http_code}' https://api.stripe.com/v1/account -u "$STRIPE_SECRET_KEY:" || true)
  if [[ "$CODE" == "200" ]]; then echo "✓ Stripe secret key works"; else echo "✗ Stripe key check returned HTTP $CODE"; fi
  if [[ "$STRIPE_WEBHOOK_SECRET" == whsec_* ]]; then echo "✓ Stripe webhook secret format looks right"; else echo "! Stripe webhook secret does not start with whsec_"; fi
fi

if [[ -n "$NOWPAYMENTS_API_KEY" ]]; then
  CODE=$(curl -sS -o /tmp/cloutslot-nowpayments-check.json -w '%{http_code}' -H "x-api-key: $NOWPAYMENTS_API_KEY" https://api.nowpayments.io/v1/currencies || true)
  if [[ "$CODE" == "200" ]]; then echo "✓ NOWPayments API key works"; else echo "✗ NOWPayments key check returned HTTP $CODE"; fi
  [[ -n "$NOWPAYMENTS_IPN_SECRET" ]] && echo "✓ NOWPayments IPN secret saved"
fi

if [[ "$SITE_URL" == http://localhost* || "$SITE_URL" == http://127.* ]]; then
  echo "! NOWPayments cannot deliver IPNs to localhost. Use your deployed HTTPS URL for live crypto payments."
fi

echo
echo "Saved $ENV_FILE."
echo "Database: run supabase/schema.sql once in your Supabase SQL editor."
echo "Stripe webhook: $SITE_URL/api/webhooks/stripe"
echo "NOWPayments IPN: $SITE_URL/api/webhooks/nowpayments"
echo
echo "Then run: npm run dev"

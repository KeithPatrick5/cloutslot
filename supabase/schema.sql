-- CloutSlot database schema for Supabase/Postgres.
-- Run once in the Supabase SQL editor before accepting live payments.

create extension if not exists pgcrypto;

create table if not exists public.listings (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 60),
  tagline text not null check (char_length(tagline) between 1 and 120),
  url text not null,
  url_key text not null unique,
  logo_url text,
  bid_cents bigint not null default 0 check (bid_cents >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_intents (
  id uuid primary key,
  provider text not null check (provider in ('stripe', 'nowpayments')),
  provider_reference text,
  listing_id uuid not null,
  name text not null,
  tagline text not null,
  url text not null,
  url_key text not null,
  logo_url text,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.bid_payments (
  id bigint generated always as identity primary key,
  checkout_id uuid not null unique references public.payment_intents(id) on delete restrict,
  provider text not null,
  provider_payment_id text not null,
  listing_id uuid not null references public.listings(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  paid_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

alter table public.listings enable row level security;
alter table public.payment_intents enable row level security;
alter table public.bid_payments enable row level security;

create or replace function public.complete_bid_payment(
  p_checkout_id uuid,
  p_provider text,
  p_provider_payment_id text,
  p_amount_cents bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  intent public.payment_intents%rowtype;
  final_listing_id uuid;
begin
  select * into intent
  from public.payment_intents
  where id = p_checkout_id
  for update;

  if not found then raise exception 'Unknown checkout id'; end if;

  if intent.status = 'paid' or exists (
    select 1 from public.bid_payments
    where checkout_id = p_checkout_id
       or (provider = p_provider and provider_payment_id = p_provider_payment_id)
  ) then return; end if;

  if intent.status <> 'pending' then raise exception 'Checkout is not pending'; end if;
  if intent.provider <> p_provider then raise exception 'Payment provider mismatch'; end if;
  if intent.amount_cents <> p_amount_cents then raise exception 'Paid amount does not match checkout'; end if;

  insert into public.listings (id, name, tagline, url, url_key, logo_url, bid_cents)
  values (intent.listing_id, intent.name, intent.tagline, intent.url, intent.url_key, nullif(intent.logo_url, ''), intent.amount_cents)
  on conflict (url_key) do update set
    name = excluded.name,
    tagline = excluded.tagline,
    url = excluded.url,
    logo_url = excluded.logo_url,
    bid_cents = public.listings.bid_cents + intent.amount_cents,
    active = true,
    updated_at = now()
  returning id into final_listing_id;

  insert into public.bid_payments (checkout_id, provider, provider_payment_id, listing_id, amount_cents)
  values (p_checkout_id, p_provider, p_provider_payment_id, final_listing_id, p_amount_cents);

  update public.payment_intents
  set status = 'paid', paid_at = now()
  where id = p_checkout_id;
end;
$$;

create or replace function public.register_listing_click(p_listing_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.listings set clicks = clicks + 1 where id = p_listing_id and active = true;
$$;

revoke all on function public.complete_bid_payment(uuid, text, text, bigint) from public;
revoke all on function public.register_listing_click(uuid) from public;

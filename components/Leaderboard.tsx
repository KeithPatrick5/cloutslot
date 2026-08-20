"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Listing } from "@/lib/types";

type Provider = "stripe" | "nowpayments";
type Props = {
  initialListings: Listing[];
  live: boolean;
  loadError?: string;
  paymentProviders: Provider[];
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function platform(url: string) {
  const value = url.toLowerCase();
  if (value.includes("instagram.com")) return "Instagram";
  if (value.includes("tiktok.com")) return "TikTok";
  if (value.includes("youtube.com") || value.includes("youtu.be")) return "YouTube";
  if (value.includes("x.com") || value.includes("twitter.com")) return "X";
  if (value.includes("twitch.tv")) return "Twitch";
  if (value.includes("facebook.com") || value.includes("fb.com")) return "Facebook";
  if (value.includes("threads.net")) return "Threads";
  if (value.includes("linkedin.com")) return "LinkedIn";
  return "Social";
}

export default function Leaderboard({ initialListings, live, loadError, paymentProviders }: Props) {
  const [listings, setListings] = useState(initialListings);
  const [serviceError, setServiceError] = useState(loadError || "");
  const [modalOpen, setModalOpen] = useState(false);
  const [suggestedBid, setSuggestedBid] = useState(Math.max(1, (initialListings[0]?.bid_cents ?? 0) / 100 + 1));
  const [provider, setProvider] = useState<Provider>(paymentProviders[0] ?? "stripe");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      setNotice("Payment received. Your position will update after confirmation.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("canceled") === "1") {
      setNotice("Checkout canceled.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/leaderboard", { cache: "no-store" });
        const json = await response.json();
        if (Array.isArray(json.listings)) setListings(json.listings);
        setServiceError(json.live === false ? json.error || "Leaderboard unavailable." : "");
      } catch {
        setServiceError("Leaderboard refresh failed.");
      }
    }, 12000);
    return () => window.clearInterval(timer);
  }, [live]);

  const firstPlace = listings[0]?.bid_cents ?? 0;
  const priceForFirst = firstPlace + 100;

  function openBid(amount?: number) {
    setSuggestedBid(amount ?? Math.max(1, priceForFirst / 100));
    setFormError("");
    setModalOpen(true);
  }

  async function submitBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      url: String(form.get("url") || ""),
      tagline: String(form.get("tagline") || ""),
      logoUrl: String(form.get("logoUrl") || ""),
      targetBidDollars: Number(form.get("bid") || 0),
      provider,
    };

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not start checkout.");
      if (!json.url) throw new Error("Payment provider did not return a checkout URL.");
      window.location.href = json.url;
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not start checkout.");
      setSubmitting(false);
    }
  }

  return (
    <main>
      <header className="header shell">
        <a className="brand" href="/">CloutSlot<span>.space</span></a>
        <a className="rules-link" href="#rules">Rules</a>
      </header>

      <section className="intro shell">
        <h1>Promote your social media.</h1>
        <p>Pay to move your Instagram, TikTok, YouTube, X, Twitch, or other social profile up the leaderboard.</p>

        <div className="claim-box">
          <div className="claim-copy">
            <span>Claim #1 for</span>
            <strong>{money(priceForFirst)}</strong>
          </div>
          <button className="primary" onClick={() => openBid()}>Promote your social</button>
        </div>

        <p className="hint">Your amount decides the rank. Already listed? Submit the same profile URL and raise your bid.</p>
      </section>

      {notice && <div className="notice shell">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      {serviceError && <div className="service-error shell">Leaderboard temporarily unavailable.</div>}

      <section className="leaderboard shell" id="leaderboard">
        <div className="leaderboard-title">
          <h2>Leaderboard</h2>
          <button className="secondary" onClick={() => openBid()}>Add your social</button>
        </div>

        <div className="table">
          {listings.map((item, index) => (
            <div className={`row ${index === 0 ? "first" : ""}`} key={item.id}>
              <div className="rank">#{index + 1}</div>
              <a className="avatar" href={`/go/${item.id}`} target="_blank" rel="noreferrer">
                {item.logo_url ? <img src={item.logo_url} alt="" /> : <span>{initials(item.name)}</span>}
              </a>
              <div className="profile">
                <a href={`/go/${item.id}`} target="_blank" rel="noreferrer" className="profile-name">{item.name}</a>
                <p><span>{platform(item.url)}</span>{item.tagline}</p>
              </div>
              <div className="clicks"><span>clicks</span>{item.clicks.toLocaleString()}</div>
              <div className="amount">{money(item.bid_cents)}</div>
              <button className="claim-rank" onClick={() => openBid(item.bid_cents / 100 + 1)}>claim for {money(item.bid_cents + 100)}</button>
            </div>
          ))}

          {listings.length === 0 && !serviceError && (
            <div className="empty">
              <strong>No one is here yet.</strong>
              <span>Be the first social on the board for $1.</span>
              <button className="primary" onClick={() => openBid(1)}>Claim #1</button>
            </div>
          )}
        </div>
      </section>

      <section className="rules shell" id="rules">
        <h2>Rules</h2>
        <p>Higher bid = higher rank. Getting outbid moves you down, not off the board. Existing profiles only pay the difference when they raise their bid. Clicks are counted publicly.</p>
      </section>

      <footer className="footer shell">CloutSlot.space · Paid social discovery</footer>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bid-title">
            <div className="modal-head">
              <h2 id="bid-title">Promote your social</h2>
              <button className="close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </div>

            <form onSubmit={submitBid}>
              <label>Handle / creator name<input name="name" maxLength={60} placeholder="@yourhandle" required /></label>
              <label>Social profile URL<input name="url" type="url" placeholder="https://instagram.com/yourhandle" autoComplete="url" required /></label>
              <label>Short bio<input name="tagline" maxLength={120} placeholder="What do you post?" required /></label>
              <label>Profile image URL <em>optional</em><input name="logoUrl" type="url" placeholder="https://..." /></label>
              <label>Total bid<div className="money-input"><span>$</span><input name="bid" type="number" min="1" step="1" defaultValue={Math.ceil(suggestedBid)} required /></div></label>

              <fieldset>
                <legend>Pay with</legend>
                <button type="button" className={provider === "stripe" ? "pay active" : "pay"} disabled={!paymentProviders.includes("stripe")} onClick={() => setProvider("stripe")}>
                  <strong>Card / wallet</strong><span>Stripe</span>
                </button>
                <button type="button" className={provider === "nowpayments" ? "pay active" : "pay"} disabled={!paymentProviders.includes("nowpayments")} onClick={() => setProvider("nowpayments")}>
                  <strong>Crypto</strong><span>NOWPayments</span>
                </button>
              </fieldset>

              {paymentProviders.length === 0 && <div className="form-error">Payments are temporarily unavailable.</div>}
              {formError && <div className="form-error">{formError}</div>}

              <button className="primary checkout" type="submit" disabled={submitting || paymentProviders.length === 0 || !live}>
                {submitting ? "Opening checkout…" : "Continue to payment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

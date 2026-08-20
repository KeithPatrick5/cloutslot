"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Listing } from "@/lib/types";

type Provider = "stripe" | "nowpayments";
type Props = { initialListings: Listing[]; demo: boolean; paymentProviders: Provider[] };

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export default function Leaderboard({ initialListings, demo, paymentProviders }: Props) {
  const [listings, setListings] = useState(initialListings);
  const [modalOpen, setModalOpen] = useState(false);
  const [suggestedBid, setSuggestedBid] = useState(Math.max(1, (initialListings[0]?.bid_cents ?? 0) / 100 + 1));
  const [provider, setProvider] = useState<Provider>(paymentProviders[0] ?? "stripe");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (demo) return;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        const json = await res.json();
        if (Array.isArray(json.listings)) setListings(json.listings);
      } catch {}
    }, 15000);
    return () => window.clearInterval(timer);
  }, [demo]);

  const stats = useMemo(() => ({
    totalBid: listings.reduce((sum, item) => sum + item.bid_cents, 0),
    clicks: listings.reduce((sum, item) => sum + item.clicks, 0),
    count: listings.length,
  }), [listings]);

  function openBid(amount?: number) {
    setSuggestedBid(amount ?? Math.max(1, (listings[0]?.bid_cents ?? 0) / 100 + 1));
    setError("");
    setModalOpen(true);
  }

  async function submitBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
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
      if (json.url) window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setSubmitting(false);
    }
  }

  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#top"><span className="brand-mark">C$</span><span>CloutSlot</span></a>
        <div className="nav-actions"><a href="#rules" className="text-link">How it works</a><button className="button small" onClick={() => openBid()}>Buy a slot</button></div>
      </header>

      <section className="hero shell" id="top">
        <div className="eyebrow"><span className="live-dot" /> LIVE MONEY LEADERBOARD</div>
        <h1>Pay more.<br />Sit higher.<br /><span>Get seen.</span></h1>
        <p className="hero-copy">Your bid is your rank. Put your company, project, newsletter, or weird side hustle in front of everyone watching.</p>
        <div className="hero-actions">
          <button className="button hero-button" onClick={() => openBid()}>Take #1 for {money((listings[0]?.bid_cents ?? 0) + 100)}</button>
          <a className="secondary-button" href="#leaderboard">See the board ↓</a>
        </div>
        <p className="microcopy">No subscription. No algorithm. No pretending this is merit-based.</p>
      </section>

      <section className="stats shell">
        <div><strong>{stats.count}</strong><span>paid slots</span></div>
        <div><strong>{money(stats.totalBid)}</strong><span>on the board</span></div>
        <div><strong>{stats.clicks.toLocaleString()}</strong><span>outbound clicks</span></div>
        <div><strong>{money((listings[0]?.bid_cents ?? 0) + 100)}</strong><span>to take #1</span></div>
      </section>

      {demo && <div className="demo-banner shell"><strong>Demo mode.</strong> Add Supabase and at least one payment provider to turn on real bidding.</div>}

      <section className="board-section shell" id="leaderboard">
        <div className="section-heading"><div><div className="eyebrow">THE BOARD</div><h2>Money talks.</h2></div><button className="button" onClick={() => openBid()}>Get on the board</button></div>
        <div className="leaderboard">
          <div className="board-head"><span>Rank</span><span>Project</span><span>Clicks</span><span>Bid</span><span /></div>
          {listings.map((item, index) => (
            <div className={`row ${index === 0 ? "winner" : ""}`} key={item.id}>
              <div className="rank">{index === 0 ? "♛" : `#${index + 1}`}</div>
              <div className="project">
                <a className="avatar" href={demo ? item.url : `/go/${item.id}`} target="_blank" rel="noreferrer">{item.logo_url ? <img src={item.logo_url} alt="" /> : <span>{initials(item.name)}</span>}</a>
                <div><a className="project-name" href={demo ? item.url : `/go/${item.id}`} target="_blank" rel="noreferrer">{item.name} ↗</a><p>{item.tagline}</p></div>
              </div>
              <div className="clicks">{item.clicks.toLocaleString()}</div>
              <div className="bid">{money(item.bid_cents)}</div>
              <div className="row-action"><button onClick={() => openBid(item.bid_cents / 100 + 1)}>Beat for {money(item.bid_cents + 100)}</button></div>
            </div>
          ))}
          {listings.length === 0 && <div className="empty">Nobody has paid yet. #1 is yours for $1.</div>}
        </div>
      </section>

      <section className="rules shell" id="rules">
        <div className="rules-copy"><div className="eyebrow">THE ENTIRE BUSINESS MODEL</div><h2>Three rules. That&apos;s it.</h2></div>
        <div className="rule-grid">
          <article><span>01</span><h3>Pay your bid.</h3><p>Your total paid amount becomes your score. Existing listings only pay the difference when they raise their bid.</p></article>
          <article><span>02</span><h3>Higher money wins.</h3><p>The board sorts by total bid. If someone pays more, they move above you. You remain listed.</p></article>
          <article><span>03</span><h3>Traffic is the prize.</h3><p>Every listing links out. Clicks are counted publicly so buyers can see whether the experiment is working.</p></article>
        </div>
      </section>

      <section className="cta shell"><p>There is no secret growth algorithm here.</p><h2>It&apos;s a public auction for attention.</h2><button className="button hero-button" onClick={() => openBid()}>Buy your slot</button></section>
      <footer className="footer shell"><div className="brand"><span className="brand-mark">C$</span><span>CloutSlot</span></div><p>Your wallet has entered the chat.</p></footer>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) setModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bid-title">
            <button className="close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            <div className="eyebrow">BUY ATTENTION</div><h2 id="bid-title">Claim your slot.</h2>
            <p className="modal-intro">Choose your total bid. If this URL is already listed, checkout only charges the difference.</p>
            <form onSubmit={submitBid}>
              <label>Project name<input name="name" maxLength={60} placeholder="Acme" required /></label>
              <label>Website URL<input name="url" type="url" placeholder="https://acme.com" required /></label>
              <label>One-line pitch<input name="tagline" maxLength={120} placeholder="Make it interesting." required /></label>
              <label>Logo URL <em>optional</em><input name="logoUrl" type="url" placeholder="https://.../logo.png" /></label>
              <label>Your total bid<div className="money-input"><span>$</span><input name="bid" type="number" min="1" step="1" defaultValue={Math.ceil(suggestedBid)} required /></div></label>
              <fieldset className="payment-methods"><legend>Pay with</legend>
                <button type="button" className={provider === "stripe" ? "payment-choice active" : "payment-choice"} disabled={!paymentProviders.includes("stripe")} onClick={() => setProvider("stripe")}><strong>Card / wallet</strong><span>Stripe</span></button>
                <button type="button" className={provider === "nowpayments" ? "payment-choice active" : "payment-choice"} disabled={!paymentProviders.includes("nowpayments")} onClick={() => setProvider("nowpayments")}><strong>Crypto</strong><span>NOWPayments</span></button>
              </fieldset>
              {paymentProviders.length === 0 && <div className="form-error">No payment provider configured. Run npm run setup:payments.</div>}
              {error && <div className="form-error">{error}</div>}
              <button className="button modal-button" type="submit" disabled={submitting || paymentProviders.length === 0}>{submitting ? "Opening checkout…" : "Continue to payment →"}</button>
            </form>
            <p className="fineprint">Listings may be removed for fraud, malware, illegal content, impersonation, or abuse. Payment buys placement, not guaranteed traffic.</p>
          </div>
        </div>
      )}
    </main>
  );
}

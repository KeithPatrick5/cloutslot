"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Listing } from "@/lib/types";

type Provider = "stripe" | "nowpayments";
type Props = { initialListings: Listing[]; demo: boolean; paymentProviders: Provider[] };

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function Leaderboard({ initialListings, demo, paymentProviders }: Props) {
  const [listings, setListings] = useState(initialListings);
  const [modalOpen, setModalOpen] = useState(false);
  const [suggestedBid, setSuggestedBid] = useState(
    Math.max(1, (initialListings[0]?.bid_cents ?? 0) / 100 + 1),
  );
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

  const stats = useMemo(
    () => ({
      totalBid: listings.reduce((sum, item) => sum + item.bid_cents, 0),
      clicks: listings.reduce((sum, item) => sum + item.clicks, 0),
      count: listings.length,
    }),
    [listings],
  );

  const leader = listings[0];
  const takeFirst = (leader?.bid_cents ?? 0) + 100;

  function openBid(amount?: number) {
    setSuggestedBid(amount ?? Math.max(1, (leader?.bid_cents ?? 0) / 100 + 1));
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
    <main id="top">
      <header className="site-header">
        <div className="shell nav">
          <a className="brand" href="#top" aria-label="CloutSlot home">
            <span className="brand-mark">C</span>
            <span className="brand-word">CloutSlot</span>
            <span className="brand-domain">.space</span>
          </a>
          <nav className="nav-actions" aria-label="Primary navigation">
            <a href="#how" className="text-link">How it works</a>
            <button className="button small" onClick={() => openBid()}>Buy a slot</button>
          </nav>
        </div>
      </header>

      <section className="intro shell">
        <div className="intro-copy">
          <div className="eyebrow"><span className="live-dot" /> Live paid leaderboard</div>
          <h1>Buy attention.<br /><span>Hold your spot.</span></h1>
          <p>
            Every dollar is a point. Higher bid means higher rank. Every slot links directly to your site.
            No algorithm, no judges, no mystery.
          </p>
          <div className="intro-actions">
            <button className="button primary" onClick={() => openBid()}>Take #1 for {money(takeFirst)}</button>
            <a href="#leaderboard" className="secondary-button">View leaderboard</a>
          </div>
        </div>

        <aside className="leader-card" aria-label="Current number one listing">
          <div className="leader-card-top">
            <span>Current #1</span>
            <span className="status-pill">LIVE</span>
          </div>
          {leader ? (
            <>
              <div className="leader-project">
                <div className="leader-logo">
                  {leader.logo_url ? <img src={leader.logo_url} alt="" /> : <span>{initials(leader.name)}</span>}
                </div>
                <div>
                  <strong>{leader.name}</strong>
                  <p>{leader.tagline}</p>
                </div>
              </div>
              <div className="leader-price">
                <span>Leading bid</span>
                <strong>{money(leader.bid_cents)}</strong>
              </div>
            </>
          ) : (
            <div className="leader-empty">
              <strong>#1 is empty.</strong>
              <p>Be the first name on the board.</p>
            </div>
          )}
          <button className="leader-card-button" onClick={() => openBid()}>
            Take first place <span>{money(takeFirst)}</span>
          </button>
        </aside>
      </section>

      <section className="market-stats shell" aria-label="Leaderboard statistics">
        <div><strong>{stats.count}</strong><span>paid slots</span></div>
        <div><strong>{money(stats.totalBid)}</strong><span>total on board</span></div>
        <div><strong>{stats.clicks.toLocaleString()}</strong><span>outbound clicks</span></div>
        <div><strong>{money(takeFirst)}</strong><span>takes #1</span></div>
      </section>

      {demo && (
        <div className="demo-banner shell">
          <strong>Demo mode.</strong> Add Supabase and a payment provider to turn on live bidding.
        </div>
      )}

      <section className="board-section shell" id="leaderboard">
        <div className="board-titlebar">
          <div>
            <div className="eyebrow">THE LEADERBOARD</div>
            <h2>Money decides the order.</h2>
          </div>
          <button className="button" onClick={() => openBid()}>Get on the board</button>
        </div>

        <div className="leaderboard">
          <div className="board-head">
            <span>Rank</span>
            <span>Project</span>
            <span>Clicks</span>
            <span>Total bid</span>
            <span />
          </div>

          {listings.map((item, index) => (
            <div className={`row ${index === 0 ? "winner" : ""}`} key={item.id}>
              <div className="rank">
                <span className="rank-number">{index + 1}</span>
              </div>

              <div className="project">
                <a className="avatar" href={demo ? item.url : `/go/${item.id}`} target="_blank" rel="noreferrer">
                  {item.logo_url ? <img src={item.logo_url} alt="" /> : <span>{initials(item.name)}</span>}
                </a>
                <div className="project-copy">
                  <a className="project-name" href={demo ? item.url : `/go/${item.id}`} target="_blank" rel="noreferrer">
                    {item.name}<span>↗</span>
                  </a>
                  <p>{item.tagline}</p>
                </div>
              </div>

              <div className="clicks"><span className="mobile-label">Clicks</span>{item.clicks.toLocaleString()}</div>
              <div className="bid"><span className="mobile-label">Bid</span>{money(item.bid_cents)}</div>
              <div className="row-action">
                <button onClick={() => openBid(item.bid_cents / 100 + 1)}>Beat {money(item.bid_cents + 100)}</button>
              </div>
            </div>
          ))}

          {listings.length === 0 && (
            <div className="empty">
              <strong>Nobody has paid yet.</strong>
              <span>#1 is yours for $1.</span>
              <button className="button" onClick={() => openBid(1)}>Claim it</button>
            </div>
          )}
        </div>
      </section>

      <section className="how shell" id="how">
        <div className="how-heading">
          <div className="eyebrow">HOW IT WORKS</div>
          <h2>Three rules. Nothing hidden.</h2>
        </div>
        <div className="rule-grid">
          <article><span>01</span><h3>Pick your total bid.</h3><p>Your bid is your score. If your site is already listed, you only pay the difference to move higher.</p></article>
          <article><span>02</span><h3>Higher money ranks higher.</h3><p>Someone can pass you at any time. You keep your listing and can raise your bid whenever you want.</p></article>
          <article><span>03</span><h3>Every click goes to you.</h3><p>Your listing links directly to your site, and outbound clicks are shown publicly on the board.</p></article>
        </div>
      </section>

      <section className="closing shell">
        <div>
          <span className="eyebrow">NO ALGORITHM. JUST A NUMBER.</span>
          <h2>How badly do you want the top slot?</h2>
        </div>
        <button className="button primary" onClick={() => openBid()}>Buy your slot</button>
      </section>

      <footer className="footer shell">
        <div className="brand"><span className="brand-mark">C</span><span className="brand-word">CloutSlot</span><span className="brand-domain">.space</span></div>
        <p>Placement is paid. Traffic is earned.</p>
      </footer>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) setModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bid-title">
            <button className="close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            <div className="eyebrow">BUY A SLOT</div>
            <h2 id="bid-title">Choose your rank.</h2>
            <p className="modal-intro">Set your total bid. If this URL is already listed, checkout only charges the difference.</p>

            <form onSubmit={submitBid}>
              <label>Project name<input name="name" maxLength={60} placeholder="Acme" required /></label>
              <label>Website URL<input name="url" type="url" placeholder="https://acme.com" required /></label>
              <label>One-line pitch<input name="tagline" maxLength={120} placeholder="Tell people why they should click." required /></label>
              <label>Logo URL <em>optional</em><input name="logoUrl" type="url" placeholder="https://.../logo.png" /></label>
              <label>Your total bid<div className="money-input"><span>$</span><input name="bid" type="number" min="1" step="1" defaultValue={Math.ceil(suggestedBid)} required /></div></label>

              <fieldset className="payment-methods">
                <legend>Pay with</legend>
                <button type="button" className={provider === "stripe" ? "payment-choice active" : "payment-choice"} disabled={!paymentProviders.includes("stripe")} onClick={() => setProvider("stripe")}>
                  <strong>Card / wallet</strong><span>Stripe</span>
                </button>
                <button type="button" className={provider === "nowpayments" ? "payment-choice active" : "payment-choice"} disabled={!paymentProviders.includes("nowpayments")} onClick={() => setProvider("nowpayments")}>
                  <strong>Crypto</strong><span>NOWPayments</span>
                </button>
              </fieldset>

              {paymentProviders.length === 0 && <div className="form-error">No payment provider is configured.</div>}
              {error && <div className="form-error">{error}</div>}
              <button className="button modal-button" type="submit" disabled={submitting || paymentProviders.length === 0}>
                {submitting ? "Opening checkout…" : "Continue to payment →"}
              </button>
            </form>

            <p className="fineprint">Listings may be removed for fraud, malware, illegal content, impersonation, or abuse. Payment buys placement, not guaranteed traffic.</p>
          </div>
        </div>
      )}
    </main>
  );
}

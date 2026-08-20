"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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
      setNotice("Payment received. Your rank will update as soon as the payment provider confirms it.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("canceled") === "1") {
      setNotice("Checkout canceled. No leaderboard change was made.");
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
        setServiceError("Live leaderboard refresh failed. Retrying automatically.");
      }
    }, 12000);
    return () => window.clearInterval(timer);
  }, [live]);

  const stats = useMemo(
    () => ({
      totalBid: listings.reduce((sum, item) => sum + item.bid_cents, 0),
      clicks: listings.reduce((sum, item) => sum + item.clicks, 0),
      count: listings.length,
    }),
    [listings],
  );

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
    <main id="top">
      <header className="site-header">
        <div className="shell nav">
          <a className="brand" href="#top" aria-label="CloutSlot home">
            <span className="brand-box">C$</span>
            <span>CloutSlot<span className="domain">.space</span></span>
          </a>
          <div className="nav-right">
            <a href="#rules">Rules</a>
            <span className={`system-state ${live && !serviceError ? "online" : "offline"}`}>
              {live && !serviceError ? "LIVE" : "STATUS"}
            </span>
            <button className="top-bid" onClick={() => openBid()}>BUY A SLOT</button>
          </div>
        </div>
      </header>

      {notice && <div className="notice shell"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}
      {serviceError && <div className="service-error shell"><strong>LIVE DATA ERROR</strong><span>{serviceError}</span></div>}

      <section className="masthead shell">
        <div className="masthead-copy">
          <div className="kicker">PUBLIC MARKET FOR ATTENTION</div>
          <h1>PAY MORE.<br />RANK HIGHER.</h1>
          <p>Your total bid is your position. Every listing is clickable. Every click is counted. No algorithm decides who gets seen.</p>
        </div>
        <div className="takeover">
          <span>PRICE TO TAKE #1</span>
          <strong>{money(priceForFirst)}</strong>
          <button onClick={() => openBid()}>TAKE THE TOP SPOT →</button>
        </div>
      </section>

      <section className="ticker shell" aria-label="Market statistics">
        <div><span>LISTINGS</span><strong>{stats.count}</strong></div>
        <div><span>MONEY ON BOARD</span><strong>{money(stats.totalBid)}</strong></div>
        <div><span>OUTBOUND CLICKS</span><strong>{stats.clicks.toLocaleString()}</strong></div>
        <div><span>LEADING BID</span><strong>{money(firstPlace)}</strong></div>
      </section>

      <section className="board shell" id="leaderboard">
        <div className="board-bar">
          <div><span className="section-number">01</span><h2>THE LEADERBOARD</h2></div>
          <p>Updated automatically. Highest paid total wins the highest position.</p>
        </div>

        <div className="table">
          <div className="table-head">
            <span>RANK</span><span>PROJECT</span><span>CLICKS</span><span>BID</span><span>ACTION</span>
          </div>

          {listings.map((item, index) => (
            <div className={`listing ${index === 0 ? "first" : ""}`} key={item.id}>
              <div className="rank">
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                {index === 0 && <span>LEADER</span>}
              </div>

              <div className="project">
                <a className="logo" href={`/go/${item.id}`} target="_blank" rel="noreferrer">
                  {item.logo_url ? <img src={item.logo_url} alt="" /> : <span>{initials(item.name)}</span>}
                </a>
                <div className="project-text">
                  <a className="project-name" href={`/go/${item.id}`} target="_blank" rel="noreferrer">{item.name} ↗</a>
                  <p>{item.tagline}</p>
                </div>
              </div>

              <div className="metric"><span>CLICKS</span><strong>{item.clicks.toLocaleString()}</strong></div>
              <div className="metric bid"><span>BID</span><strong>{money(item.bid_cents)}</strong></div>
              <div className="outbid"><button onClick={() => openBid(item.bid_cents / 100 + 1)}>BEAT WITH {money(item.bid_cents + 100)}</button></div>
            </div>
          ))}

          {listings.length === 0 && !serviceError && (
            <div className="empty-board">
              <span>NO PAID LISTINGS YET</span>
              <strong>#1 costs $1.</strong>
              <button onClick={() => openBid(1)}>CLAIM FIRST PLACE →</button>
            </div>
          )}
        </div>
      </section>

      <section className="rules shell" id="rules">
        <div className="board-bar">
          <div><span className="section-number">02</span><h2>RULES</h2></div>
          <p>Intentionally simple.</p>
        </div>
        <div className="rules-grid">
          <article><span>01</span><h3>YOUR BID IS YOUR SCORE.</h3><p>Choose the total amount you want displayed. Higher total means higher rank.</p></article>
          <article><span>02</span><h3>REBIDS PAY THE DIFFERENCE.</h3><p>If the same URL is already listed, you only pay the amount needed to raise its existing total.</p></article>
          <article><span>03</span><h3>YOUR SLOT STAYS.</h3><p>Getting outbid moves you down; it does not remove you. You can raise the total again at any time.</p></article>
          <article><span>04</span><h3>CLICKS ARE PUBLIC.</h3><p>Every outbound visit through the board increments the public click count for that listing.</p></article>
        </div>
      </section>

      <section className="final-cta shell">
        <span>THE BOARD DOESN&apos;T CARE WHO YOU ARE.</span>
        <h2>IT ONLY CARES WHAT YOU BID.</h2>
        <button onClick={() => openBid()}>BUY YOUR POSITION — {money(priceForFirst)} TAKES #1</button>
      </section>

      <footer className="footer shell">
        <span>© 2026 CLOUTSLOT.SPACE</span>
        <span>PLACEMENT IS PAID. TRAFFIC IS NOT GUARANTEED.</span>
      </footer>

      {modalOpen && (
        <div className="drawer-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setModalOpen(false); }}>
          <aside className="bid-drawer" role="dialog" aria-modal="true" aria-labelledby="bid-title">
            <div className="drawer-head">
              <div><span>NEW BID</span><h2 id="bid-title">BUY YOUR POSITION</h2></div>
              <button className="close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </div>

            <form onSubmit={submitBid}>
              <label>PROJECT NAME<input name="name" maxLength={60} autoComplete="organization" required /></label>
              <label>WEBSITE URL<input name="url" type="url" placeholder="https://example.com" autoComplete="url" required /></label>
              <label>ONE-LINE PITCH<input name="tagline" maxLength={120} placeholder="Why should anyone click?" required /></label>
              <label>LOGO URL <em>OPTIONAL</em><input name="logoUrl" type="url" placeholder="https://example.com/logo.png" /></label>

              <label className="bid-field">TOTAL BID
                <div><span>$</span><input name="bid" type="number" min="1" step="1" defaultValue={Math.ceil(suggestedBid)} required /></div>
              </label>

              <fieldset>
                <legend>PAYMENT METHOD</legend>
                <button type="button" className={provider === "stripe" ? "pay active" : "pay"} disabled={!paymentProviders.includes("stripe")} onClick={() => setProvider("stripe")}>
                  <strong>CARD / WALLET</strong><span>Stripe</span>
                </button>
                <button type="button" className={provider === "nowpayments" ? "pay active" : "pay"} disabled={!paymentProviders.includes("nowpayments")} onClick={() => setProvider("nowpayments")}>
                  <strong>CRYPTO</strong><span>NOWPayments</span>
                </button>
              </fieldset>

              {paymentProviders.length === 0 && <div className="form-error">Payments are temporarily unavailable.</div>}
              {formError && <div className="form-error">{formError}</div>}

              <button className="checkout" type="submit" disabled={submitting || paymentProviders.length === 0 || !live}>
                {submitting ? "OPENING CHECKOUT…" : "CONTINUE TO PAYMENT →"}
              </button>
            </form>

            <div className="drawer-foot">
              <p>For an existing URL, payment increases its existing bid but does not replace that listing&apos;s identity.</p>
              <p>Fraud, malware, impersonation, illegal content, and abuse may be removed.</p>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

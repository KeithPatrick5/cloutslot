"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Listing } from "@/lib/types";

type Provider = "stripe" | "nowpayments";

type Props = {
  initialListings: Listing[];
  live: boolean;
  loadError?: string;
  paymentProviders: Provider[];
};

type SocialPlatform = {
  name: string;
  key: string;
  mark: string;
};

const NETWORKS = ["Instagram", "TikTok", "YouTube", "X", "Twitch", "Threads"];

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

function platform(url: string): SocialPlatform {
  const value = url.toLowerCase();
  if (value.includes("instagram.com")) return { name: "Instagram", key: "instagram", mark: "IG" };
  if (value.includes("tiktok.com")) return { name: "TikTok", key: "tiktok", mark: "TK" };
  if (value.includes("youtube.com") || value.includes("youtu.be")) return { name: "YouTube", key: "youtube", mark: "YT" };
  if (value.includes("x.com") || value.includes("twitter.com")) return { name: "X", key: "x", mark: "X" };
  if (value.includes("twitch.tv")) return { name: "Twitch", key: "twitch", mark: "TV" };
  if (value.includes("threads.net")) return { name: "Threads", key: "threads", mark: "TH" };
  if (value.includes("facebook.com") || value.includes("fb.com")) return { name: "Facebook", key: "facebook", mark: "FB" };
  if (value.includes("linkedin.com")) return { name: "LinkedIn", key: "linkedin", mark: "IN" };
  return { name: "Social", key: "social", mark: "@" };
}

function guessName(url: string) {
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "";
    return path ? `@${path.replace(/^@/, "")}` : "";
  } catch {
    return "";
  }
}

function validProfileUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function Leaderboard({ initialListings, live, loadError, paymentProviders }: Props) {
  const initialFirstPrice = Math.max(1, (initialListings[0]?.bid_cents ?? 0) / 100 + 1);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [listings, setListings] = useState(initialListings);
  const [databaseLive, setDatabaseLive] = useState(live);
  const [serviceError, setServiceError] = useState(loadError || "");
  const [modalOpen, setModalOpen] = useState(false);
  const [suggestedBid, setSuggestedBid] = useState(initialFirstPrice);
  const [suggestedUrl, setSuggestedUrl] = useState("");
  const [quickUrl, setQuickUrl] = useState("");
  const [quickBid, setQuickBid] = useState(initialFirstPrice);
  const [quickError, setQuickError] = useState("");
  const [provider, setProvider] = useState<Provider>(paymentProviders[0] ?? "stripe");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [onlineVisitors, setOnlineVisitors] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let nextNotice = "";
    if (params.get("paid") === "1") {
      nextNotice = "Payment received. Your spot appears as soon as the provider confirms it.";
    } else if (params.get("canceled") === "1") {
      nextNotice = "Checkout canceled. Nothing changed on the board.";
    }

    if (nextNotice) {
      window.history.replaceState({}, "", window.location.pathname);
      const timer = window.setTimeout(() => setNotice(nextNotice), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    let stopped = false;

    async function refreshBoard() {
      try {
        const response = await fetch("/api/leaderboard", { cache: "no-store" });
        const json = await response.json();
        if (stopped) return;

        if (Array.isArray(json.listings)) {
          setListings(json.listings);
          const minimum = Math.max(1, (json.listings[0]?.bid_cents ?? 0) / 100 + 1);
          setQuickBid((current) => Math.max(current, minimum));
        }
        setDatabaseLive(json.live === true);
        setServiceError(json.live === false ? json.error || "The live board is unavailable." : "");
      } catch {
        if (!stopped) {
          setDatabaseLive(false);
          setServiceError("The live board could not refresh.");
        }
      }
    }

    if (!live) void refreshBoard();
    const timer = window.setInterval(refreshBoard, 12000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [live]);

  useEffect(() => {
    let stopped = false;

    async function refreshTraffic(kind: "pageview" | "heartbeat") {
      try {
        const response = await fetch("/api/analytics", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind, path: window.location.pathname }),
        });
        const json = await response.json();
        if (!stopped && response.ok && json.available === true && Number.isFinite(json.online)) {
          setOnlineVisitors(json.online);
        }
      } catch {
        // The counter stays hidden until a verified database value is available.
      }
    }

    void refreshTraffic("pageview");
    const timer = window.setInterval(() => refreshTraffic("heartbeat"), 60000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => firstInputRef.current?.focus(), 20);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [modalOpen]);

  const leader = listings[0];
  const priceForFirst = (leader?.bid_cents ?? 0) + 100;

  function openBid(amount?: number, url = "") {
    setSuggestedBid(amount ?? Math.max(1, priceForFirst / 100));
    setSuggestedUrl(url);
    setFormError("");
    setModalOpen(true);
  }

  function startQuickBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuickError("");

    if (!validProfileUrl(quickUrl)) {
      setQuickError("Paste the full link to your social profile.");
      return;
    }

    openBid(Math.max(1, quickBid), quickUrl.trim());
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
      if (!json.url) throw new Error("The payment provider did not return a checkout URL.");
      window.location.assign(json.url);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not start checkout.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="shell nav-row">
          <Link className="wordmark" href="/" aria-label="CloutSlot home">
            <span aria-hidden="true">C/S</span>
            CloutSlot
          </Link>
          {onlineVisitors !== null ? (
            <div className="traffic-counter" aria-label={`${onlineVisitors} visitors online now`}>
              <span aria-hidden="true" />
              <strong>{onlineVisitors.toLocaleString()}</strong>
              <em>online now</em>
            </div>
          ) : null}
          <nav aria-label="Primary navigation">
            <a href="#board">Leaderboard</a>
            <a href="#how">How it works</a>
            <button type="button" onClick={() => openBid()}>Add your profile</button>
          </nav>
        </div>
      </header>

      <main className="shell page-shell">
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-copy">
            <span className="kicker">PAID SOCIAL LEADERBOARD</span>
            <h1 id="page-title">Put your social profile on the board.</h1>
            <p>Bid for visibility. Higher totals rank higher, and every profile click goes straight to your social page.</p>
            <div className="network-list" aria-label="Supported networks">
              {NETWORKS.map((network) => <span key={network}>{network}</span>)}
              <span>+ more</span>
            </div>
          </div>
          <aside className="rule-note" aria-label="How ranking works">
            <span>THE RULE</span>
            <strong>Highest total takes #1.</strong>
            <p>Already listed? Submit the same profile URL and pay only the difference.</p>
          </aside>
        </section>

        <section className="bid-desk" aria-labelledby="bid-desk-title">
          <div className="desk-heading">
            <span id="bid-desk-title">Enter the board</span>
            <strong>{leader ? `${money(priceForFirst)} takes #1` : "$1 claims the first spot"}</strong>
          </div>
          <form className="quick-form" onSubmit={startQuickBid} noValidate>
            <label className="profile-url-field">
              <span>Social profile URL</span>
              <input
                type="url"
                value={quickUrl}
                onChange={(event) => setQuickUrl(event.target.value)}
                placeholder="https://instagram.com/yourname"
                autoComplete="url"
                aria-invalid={Boolean(quickError)}
              />
            </label>
            <label className="quick-bid-field">
              <span>Total bid</span>
              <div><b>$</b><input type="number" min="1" step="1" value={quickBid} onChange={(event) => setQuickBid(Number(event.target.value))} /></div>
            </label>
            <button className="continue-button" type="submit">Continue <span aria-hidden="true">→</span></button>
          </form>
          {quickError ? <p className="quick-error" role="alert">{quickError}</p> : null}
        </section>

        {notice ? (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">×</button>
          </div>
        ) : null}

        <section className="board-section" id="board" aria-labelledby="board-title">
          <div className="board-title-row">
            <div>
              <span className="kicker">LIVE RANKING</span>
              <h2 id="board-title">Social leaderboard</h2>
            </div>
            <div className="board-actions">
              <span>{listings.length} {listings.length === 1 ? "profile" : "profiles"}</span>
              <button type="button" onClick={() => openBid()}>Add yours</button>
            </div>
          </div>

          {serviceError ? (
            <div className="service-error" role="status">
              <strong>Board temporarily unavailable.</strong>
              <span>We&apos;re reconnecting automatically.</span>
            </div>
          ) : null}

          <div className="board-table">
            <div className="table-labels" aria-hidden="true">
              <span>Rank</span><span>Profile</span><span>Clicks</span><span>Total bid</span><span />
            </div>

            {listings.map((item, index) => {
              const social = platform(item.url);
              return (
                <article className={`listing ${index === 0 ? "first-place" : ""}`} key={item.id}>
                  <div className="listing-rank">
                    <span>{index === 0 ? "TOP" : "RANK"}</span>
                    <strong>{String(index + 1).padStart(2, "0")}</strong>
                  </div>
                  <div className="profile-cell">
                    <a className={`avatar ${social.key}`} href={`/go/${item.id}`} target="_blank" rel="noreferrer" aria-label={`Open ${item.name}`}>
                      {item.logo_url ? <Image src={item.logo_url} alt="" width={46} height={46} unoptimized /> : <span>{initials(item.name)}</span>}
                    </a>
                    <div className="profile-copy">
                      <div>
                        <a href={`/go/${item.id}`} target="_blank" rel="noreferrer">{item.name}</a>
                        <span className="network-tag">{social.mark} · {social.name}</span>
                      </div>
                      <p>{item.tagline}</p>
                    </div>
                  </div>
                  <div className="listing-stat"><span>Clicks</span><strong>{item.clicks.toLocaleString()}</strong></div>
                  <div className="listing-stat bid-total"><span>Total bid</span><strong>{money(item.bid_cents)}</strong></div>
                  <button className="row-bid" type="button" onClick={() => openBid(item.bid_cents / 100 + 1)}>
                    Bid {money(item.bid_cents + 100)}+
                  </button>
                </article>
              );
            })}

            {listings.length === 0 && !serviceError ? (
              <div className="open-rank">
                <div className="listing-rank"><span>TOP</span><strong>01</strong></div>
                <div className="open-profile">
                  <div className="empty-avatar" aria-hidden="true">@</div>
                  <div><strong>First place is open</strong><span>Your profile could be the first click on the board.</span></div>
                </div>
                <div className="open-networks" aria-label="Open to any social network">IG&nbsp;&nbsp;TK&nbsp;&nbsp;YT&nbsp;&nbsp;X</div>
                <div className="listing-stat bid-total"><span>Starts at</span><strong>$1</strong></div>
                <button className="row-bid primary-row-bid" type="button" onClick={() => openBid(1)}>Claim #1</button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="how-section" id="how" aria-labelledby="how-title">
          <div className="how-heading">
            <span className="kicker">NO SUBSCRIPTION. NO ACCOUNT.</span>
            <h2 id="how-title">How CloutSlot works</h2>
          </div>
          <ol>
            <li><span>01</span><div><strong>Add a profile</strong><p>Submit the social page you want people to visit.</p></div></li>
            <li><span>02</span><div><strong>Choose the total</strong><p>Your paid total determines where you rank.</p></div></li>
            <li><span>03</span><div><strong>Get direct clicks</strong><p>Visitors leave CloutSlot and land on your profile.</p></div></li>
          </ol>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell"><strong>CloutSlot</strong><span>Paid placement for social profiles.</span><a href="#board">Back to leaderboard ↑</a></div>
      </footer>

      {modalOpen ? (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setModalOpen(false); }}>
          <section className="bid-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-note">
            <div className="modal-header">
              <div><span className="kicker">NEW BID</span><h2 id="modal-title">Add your social profile</h2></div>
              <button className="modal-close" type="button" onClick={() => setModalOpen(false)} aria-label="Close bid form">×</button>
            </div>

            <p className="modal-note" id="modal-note">Higher totals rank higher. Existing profile URLs are charged only the difference needed to reach the new total.</p>

            <form className="bid-form" onSubmit={submitBid}>
              <div className="field-grid">
                <label>
                  <span>Handle or creator name</span>
                  <input ref={firstInputRef} name="name" maxLength={60} defaultValue={guessName(suggestedUrl)} placeholder="@yourname" required />
                </label>
                <label>
                  <span>Social profile URL</span>
                  <input name="url" type="url" defaultValue={suggestedUrl} placeholder="https://instagram.com/yourname" autoComplete="url" required />
                </label>
                <label className="wide-field">
                  <span>Short description</span>
                  <input name="tagline" maxLength={120} placeholder="What will people find on your profile?" required />
                </label>
                <label className="wide-field">
                  <span>Profile image URL <em>optional</em></span>
                  <input name="logoUrl" type="url" placeholder="https://..." />
                </label>
              </div>

              <div className="payment-row">
                <label className="total-field">
                  <span>Total bid</span>
                  <div><b>$</b><input name="bid" type="number" min="1" step="1" defaultValue={Math.ceil(suggestedBid)} required /></div>
                </label>
                <fieldset>
                  <legend>Payment method</legend>
                  <button type="button" aria-pressed={provider === "stripe"} className={provider === "stripe" ? "pay-option selected" : "pay-option"} disabled={!paymentProviders.includes("stripe")} onClick={() => setProvider("stripe")}>
                    <span className="selection-dot" aria-hidden="true" /><strong>Card / wallet</strong><small>Stripe</small>
                  </button>
                  <button type="button" aria-pressed={provider === "nowpayments"} className={provider === "nowpayments" ? "pay-option selected" : "pay-option"} disabled={!paymentProviders.includes("nowpayments")} onClick={() => setProvider("nowpayments")}>
                    <span className="selection-dot" aria-hidden="true" /><strong>Crypto</strong><small>NOWPayments</small>
                  </button>
                </fieldset>
              </div>

              {paymentProviders.length === 0 ? <div className="form-error">Payments are temporarily unavailable.</div> : null}
              {!databaseLive ? <div className="form-error">The live board is reconnecting. Checkout will reopen automatically.</div> : null}
              {formError ? <div className="form-error" role="alert">{formError}</div> : null}

              <div className="modal-footer">
                <span>You will review the exact charge on the secure payment page.</span>
                <button className="checkout-button" type="submit" disabled={submitting || paymentProviders.length === 0 || !databaseLive}>
                  {submitting ? "Opening checkout…" : "Continue to payment"} <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

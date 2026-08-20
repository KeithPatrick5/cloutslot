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

type SocialPlatform = { name: string; key: string; mark: string };

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

function platform(url: string): SocialPlatform {
  const value = url.toLowerCase();
  if (value.includes("instagram.com")) return { name: "Instagram", key: "instagram", mark: "IG" };
  if (value.includes("tiktok.com")) return { name: "TikTok", key: "tiktok", mark: "TT" };
  if (value.includes("youtube.com") || value.includes("youtu.be")) return { name: "YouTube", key: "youtube", mark: "YT" };
  if (value.includes("x.com") || value.includes("twitter.com")) return { name: "X", key: "x", mark: "X" };
  if (value.includes("twitch.tv")) return { name: "Twitch", key: "twitch", mark: "TW" };
  if (value.includes("facebook.com") || value.includes("fb.com")) return { name: "Facebook", key: "facebook", mark: "FB" };
  if (value.includes("threads.net")) return { name: "Threads", key: "threads", mark: "TH" };
  if (value.includes("linkedin.com")) return { name: "LinkedIn", key: "linkedin", mark: "IN" };
  return { name: "Social", key: "social", mark: "@" };
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
      setNotice("Payment received. Your position updates as soon as the payment provider confirms it.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("canceled") === "1") {
      setNotice("Checkout canceled. Nothing changed on the board.");
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

  const leader = listings[0];
  const firstPlace = leader?.bid_cents ?? 0;
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
      <header className="site-header">
        <div className="shell nav">
          <a className="brand" href="/" aria-label="CloutSlot home">
            <span className="brand-mark">CS</span>
            <span className="brand-name">CloutSlot<span>.space</span></span>
          </a>
          <nav>
            <a href="#leaderboard">Leaderboard</a>
            <a href="#how">How it works</a>
            <button onClick={() => openBid()}>Promote your social</button>
          </nav>
        </div>
      </header>

      <section className="hero shell">
        <div className="eyebrow">PAID SOCIAL DISCOVERY</div>
        <h1>Put your social where people can actually see it.</h1>
        <p>Promote your profile. Bid for a higher spot. Every listing sends people straight to your social.</p>
        <div className="platform-line" aria-label="Supported social platforms">
          <span>Instagram</span><b>·</b><span>TikTok</span><b>·</b><span>YouTube</span><b>·</b><span>X</span><b>·</b><span>Twitch</span><b>·</b><span>Threads</span><b>·</b><span>and more</span>
        </div>
      </section>

      <section className="bid-strip shell">
        <div className="spot">
          <span className="label">TOP SPOT</span>
          <strong>#1</strong>
        </div>
        <div className="leader-now">
          <span className="label">CURRENTLY</span>
          <strong>{leader ? leader.name : "Open"}</strong>
          <small>{leader ? `${platform(leader.url).name} · ${leader.clicks.toLocaleString()} clicks` : "Nobody has claimed it yet"}</small>
        </div>
        <div className="take-price">
          <span className="label">TAKE #1 FOR</span>
          <strong>{money(priceForFirst)}</strong>
        </div>
        <button className="claim-top" onClick={() => openBid()}>Claim the top spot →</button>
      </section>

      {notice && <div className="notice shell"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}

      <section className="board shell" id="leaderboard">
        <div className="section-head">
          <div>
            <span className="eyebrow">LIVE BOARD</span>
            <h2>Leaderboard</h2>
          </div>
          <div className="board-meta">
            <span>{listings.length} {listings.length === 1 ? "social" : "socials"} listed</span>
            <button onClick={() => openBid()}>+ Add yours</button>
          </div>
        </div>

        {serviceError && <div className="service-error"><strong>Leaderboard reconnecting.</strong><span>The database is temporarily unavailable.</span></div>}

        <div className="leader-table">
          <div className="table-head">
            <span>RANK</span><span>PROFILE</span><span>CLICKS</span><span>BID</span><span />
          </div>

          {listings.map((item, index) => {
            const social = platform(item.url);
            return (
              <div className={`listing-row ${index === 0 ? "winner" : ""}`} key={item.id}>
                <div className="rank-number">{String(index + 1).padStart(2, "0")}</div>

                <div className="profile-cell">
                  <a className="avatar" href={`/go/${item.id}`} target="_blank" rel="noreferrer">
                    {item.logo_url ? <img src={item.logo_url} alt="" /> : <span>{initials(item.name)}</span>}
                  </a>
                  <div className="profile-copy">
                    <div className="profile-topline">
                      <a className="profile-name" href={`/go/${item.id}`} target="_blank" rel="noreferrer">{item.name} ↗</a>
                      <span className={`platform-tag ${social.key}`}>{social.mark} {social.name}</span>
                    </div>
                    <p>{item.tagline}</p>
                  </div>
                </div>

                <div className="metric"><span>CLICKS</span><strong>{item.clicks.toLocaleString()}</strong></div>
                <div className="metric bid"><span>BID</span><strong>{money(item.bid_cents)}</strong></div>
                <button className="outbid" onClick={() => openBid(item.bid_cents / 100 + 1)}>Take spot for {money(item.bid_cents + 100)}</button>
              </div>
            );
          })}

          {listings.length === 0 && !serviceError && (
            <div className="open-slot">
              <div className="rank-number">01</div>
              <div className="open-copy"><strong>This spot is open.</strong><span>Your social could be the first thing people see.</span></div>
              <div className="open-price"><span>STARTS AT</span><strong>$1</strong></div>
              <button onClick={() => openBid(1)}>Claim #1 →</button>
            </div>
          )}
        </div>
      </section>

      <section className="how shell" id="how">
        <div className="section-head simple">
          <div><span className="eyebrow">THAT'S IT</span><h2>How it works</h2></div>
        </div>
        <div className="steps">
          <div><span>01</span><h3>Add your social</h3><p>Submit the profile you want people to discover.</p></div>
          <div><span>02</span><h3>Choose your bid</h3><p>Higher bids sit higher on the public leaderboard.</p></div>
          <div><span>03</span><h3>Get seen</h3><p>Every profile click goes directly to your social and is counted publicly.</p></div>
        </div>
        <p className="fine-rule">Already listed? Use the same profile URL and you only pay the difference to raise the bid. Getting outbid moves you down; it does not remove you.</p>
      </section>

      <footer className="footer shell">
        <strong>CloutSlot.space</strong>
        <span>Paid placement. Real outbound clicks.</span>
      </footer>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bid-title">
            <div className="modal-head">
              <div><span className="eyebrow">GET ON THE BOARD</span><h2 id="bid-title">Promote your social</h2></div>
              <button className="close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </div>

            <div className="modal-price"><span>Current price to take #1</span><strong>{money(priceForFirst)}</strong></div>

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

              <button className="checkout" type="submit" disabled={submitting || paymentProviders.length === 0 || !live}>
                {submitting ? "Opening checkout…" : "Continue to payment →"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

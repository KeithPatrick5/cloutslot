"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MINIMUM_CHARGE_CENTS, MINIMUM_PUBLIC_BID_CENTS, OUTBID_INCREMENT_CENTS } from "@/lib/bids";
import {
  detectSocialPlatform,
  resolveSocialProfile,
  SOCIAL_PLATFORMS,
  type SocialPlatformId,
} from "@/lib/social";
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
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
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

export default function Leaderboard({ initialListings, live, loadError, paymentProviders }: Props) {
  const initialFirstPrice = Math.max(
    MINIMUM_PUBLIC_BID_CENTS,
    (initialListings[0]?.bid_cents ?? 0) + OUTBID_INCREMENT_CENTS,
  ) / 100;
  const firstInputRef = useRef<HTMLInputElement>(null);
  const profileRequestRef = useRef(0);
  const [listings, setListings] = useState(initialListings);
  const [databaseLive, setDatabaseLive] = useState(live);
  const [serviceError, setServiceError] = useState(loadError || "");
  const [modalOpen, setModalOpen] = useState(false);
  const [suggestedBid, setSuggestedBid] = useState(initialFirstPrice);
  const [quickUrl, setQuickUrl] = useState("");
  const [quickBid, setQuickBid] = useState(initialFirstPrice);
  const [quickError, setQuickError] = useState("");
  const [provider, setProvider] = useState<Provider>(paymentProviders[0] ?? "stripe");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [onlineVisitors, setOnlineVisitors] = useState<number | null>(null);
  const [profilePlatform, setProfilePlatform] = useState<SocialPlatformId>("instagram");
  const [profileInput, setProfileInput] = useState("");
  const [resolvedProfileUrl, setResolvedProfileUrl] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileTagline, setProfileTagline] = useState("");
  const [profileLogoUrl, setProfileLogoUrl] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileStatus, setProfileStatus] = useState("");
  const [editingDetails, setEditingDetails] = useState(false);

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
          const minimum = Math.max(
            MINIMUM_PUBLIC_BID_CENTS,
            (json.listings[0]?.bid_cents ?? 0) + OUTBID_INCREMENT_CENTS,
          ) / 100;
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
  const priceForFirst = Math.max(
    MINIMUM_PUBLIC_BID_CENTS,
    (leader?.bid_cents ?? 0) + OUTBID_INCREMENT_CENTS,
  );
  const providerMinimum = MINIMUM_CHARGE_CENTS[provider] / 100;

  function applyProfileFallback(value: string, selectedPlatform: SocialPlatformId) {
    setProfileInput(value);
    setProfileStatus("");
    setEditingDetails(false);

    const detected = detectSocialPlatform(value);
    const nextPlatform = detected ?? selectedPlatform;
    if (detected) setProfilePlatform(detected);

    try {
      const profile = resolveSocialProfile(value, nextPlatform);
      setResolvedProfileUrl(profile.url);
      setProfileName(profile.handle);
      setProfileTagline(`Follow ${profile.handle} on ${profile.platformLabel}.`);
      setProfileLogoUrl(profile.avatarUrl);
    } catch {
      setResolvedProfileUrl("");
      setProfileName("");
      setProfileTagline("");
      setProfileLogoUrl("");
    }
  }

  function openBid(amount?: number, url = "") {
    setSuggestedBid(Math.max(providerMinimum, amount ?? priceForFirst / 100));
    applyProfileFallback(url, detectSocialPlatform(url) ?? profilePlatform);
    setFormError("");
    setModalOpen(true);
  }

  function startQuickBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuickError("");

    try {
      resolveSocialProfile(quickUrl, profilePlatform);
    } catch (error) {
      setQuickError(error instanceof Error ? error.message : "Enter your social username or profile URL.");
      return;
    }

    openBid(Math.max(MINIMUM_PUBLIC_BID_CENTS / 100, quickBid), quickUrl.trim());
  }

  async function loadProfile() {
    const requestId = profileRequestRef.current + 1;
    profileRequestRef.current = requestId;
    setProfileLoading(true);
    setProfileStatus("");
    setFormError("");

    try {
      const response = await fetch("/api/profile-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform: profilePlatform, value: profileInput }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not read that profile.");
      if (requestId !== profileRequestRef.current) return;

      const profile = json.profile;
      setProfilePlatform(profile.platform);
      setResolvedProfileUrl(profile.url);
      setProfileName(profile.name);
      setProfileTagline(profile.tagline);
      setProfileLogoUrl(profile.avatarUrl || "");
      setProfileStatus(profile.metadataFound ? "Profile details loaded." : "Profile ready. You can edit the details below.");
    } catch (error) {
      if (requestId === profileRequestRef.current) {
        setFormError(error instanceof Error ? error.message : "Could not read that profile.");
      }
    } finally {
      if (requestId === profileRequestRef.current) setProfileLoading(false);
    }
  }

  function choosePlatform(nextPlatform: SocialPlatformId) {
    setProfilePlatform(nextPlatform);
    if (profileInput) applyProfileFallback(profileInput, nextPlatform);
  }

  function chooseProvider(nextProvider: Provider) {
    setProvider(nextProvider);
    setSuggestedBid((current) => Math.max(current, MINIMUM_CHARGE_CENTS[nextProvider] / 100));
  }

  async function submitBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");

    let profile;
    try {
      profile = resolveSocialProfile(profileInput, profilePlatform);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Enter a valid social profile.");
      setSubmitting(false);
      return;
    }

    let submittedName = profileName || profile.handle;
    let submittedTagline = profileTagline || `Follow ${profile.handle} on ${profile.platformLabel}.`;
    let submittedLogoUrl = profileLogoUrl;
    let submittedUrl = resolvedProfileUrl || profile.url;

    if (!editingDetails && profileStatus !== "Profile details loaded.") {
      try {
        const previewResponse = await fetch("/api/profile-preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ platform: profilePlatform, value: profileInput }),
        });
        const previewJson = await previewResponse.json();
        if (previewResponse.ok && previewJson.profile) {
          submittedName = previewJson.profile.name;
          submittedTagline = previewJson.profile.tagline;
          submittedLogoUrl = previewJson.profile.avatarUrl || "";
          submittedUrl = previewJson.profile.url;
        }
      } catch {
        // Continue with the safe username-derived fallback.
      }
    }

    const payload = {
      name: submittedName,
      url: submittedUrl,
      tagline: submittedTagline,
      logoUrl: submittedLogoUrl,
      targetBidDollars: suggestedBid,
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
            <strong>{leader ? `${money(priceForFirst)} takes #1` : `${money(MINIMUM_PUBLIC_BID_CENTS)} claims the first spot`}</strong>
          </div>
          <form className="quick-form" onSubmit={startQuickBid} noValidate>
            <label className="profile-url-field">
              <span>Social username or profile URL</span>
              <input
                type="text"
                value={quickUrl}
                onChange={(event) => setQuickUrl(event.target.value)}
                placeholder="@yourname or paste your profile link"
                autoComplete="url"
                aria-invalid={Boolean(quickError)}
              />
            </label>
            <label className="quick-bid-field">
              <span>Total bid</span>
              <div><b>$</b><input type="number" min="0.5" step="0.01" value={quickBid} onChange={(event) => setQuickBid(Number(event.target.value))} /></div>
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
                  <button className="row-bid" type="button" onClick={() => openBid((item.bid_cents + OUTBID_INCREMENT_CENTS) / 100)}>
                    Bid {money(item.bid_cents + OUTBID_INCREMENT_CENTS)}+
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
                <div className="listing-stat bid-total"><span>Starts at</span><strong>{money(MINIMUM_PUBLIC_BID_CENTS)}</strong></div>
                <button className="row-bid primary-row-bid" type="button" onClick={() => openBid(MINIMUM_PUBLIC_BID_CENTS / 100)}>Claim #1</button>
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
        <div className="shell">
          <strong>CloutSlot</strong>
          <span className="footer-credit">
            Inspired by <a href="https://outbid.lol" target="_blank" rel="noopener noreferrer">outbid.lol</a>
            <span aria-hidden="true"> · </span>
            Credit to <a href="https://x.com/jonathan_wilke" target="_blank" rel="noopener noreferrer">@jonathan_wilke</a>
            <span aria-hidden="true"> · </span>
            <a href="https://unavatar.io" target="_blank" rel="noopener noreferrer">Avatars by Unavatar</a>
          </span>
          <a className="back-to-board" href="#board">Back to leaderboard ↑</a>
        </div>
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
              <div className="profile-entry">
                <span className="field-label">Choose your network</span>
                <div className="platform-picker" role="group" aria-label="Social network">
                  {SOCIAL_PLATFORMS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={profilePlatform === item.id ? "selected" : ""}
                      aria-pressed={profilePlatform === item.id}
                      onClick={() => choosePlatform(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <label className="profile-identity-field">
                  <span>Username or profile URL</span>
                  <div className="profile-lookup-control">
                    <input
                      ref={firstInputRef}
                      type="text"
                      value={profileInput}
                      onChange={(event) => applyProfileFallback(event.target.value, profilePlatform)}
                      placeholder="@yourname"
                      autoComplete="url"
                      required
                    />
                    <button type="button" onClick={loadProfile} disabled={profileLoading || !profileInput.trim()}>
                      {profileLoading ? "Loading…" : "Get profile"}
                    </button>
                  </div>
                  <small>Paste a full link and we&apos;ll detect the network automatically.</small>
                </label>
              </div>

              {resolvedProfileUrl ? (
                <div className="profile-preview">
                  <div className="preview-avatar" aria-hidden="true">
                    {profileLogoUrl ? (
                      <Image
                        src={profileLogoUrl}
                        alt=""
                        width={48}
                        height={48}
                        unoptimized
                        onError={() => setProfileLogoUrl("")}
                      />
                    ) : <span>{initials(profileName || "Social")}</span>}
                  </div>
                  <div className="preview-copy">
                    <strong>{profileName}</strong>
                    <span>{resolvedProfileUrl}</span>
                    <p>{profileTagline}</p>
                    {profileStatus ? <em>{profileStatus}</em> : null}
                  </div>
                  <button className="edit-profile-button" type="button" onClick={() => setEditingDetails((current) => !current)}>
                    {editingDetails ? "Done" : "Edit"}
                  </button>
                </div>
              ) : null}

              {editingDetails ? (
                <div className="field-grid profile-edit-fields">
                  <label>
                    <span>Display name</span>
                    <input value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={60} required />
                  </label>
                  <label>
                    <span>Profile image URL <em>optional</em></span>
                    <input value={profileLogoUrl} onChange={(event) => setProfileLogoUrl(event.target.value)} type="url" placeholder="https://..." />
                  </label>
                  <label className="wide-field">
                    <span>Short description</span>
                    <input value={profileTagline} onChange={(event) => setProfileTagline(event.target.value)} maxLength={120} required />
                  </label>
                </div>
              ) : null}

              <div className="payment-row">
                <label className="total-field">
                  <span>Total bid</span>
                  <div><b>$</b><input name="bid" type="number" min={providerMinimum} step="0.01" value={suggestedBid} onChange={(event) => setSuggestedBid(Number(event.target.value))} required /></div>
                  <small>{provider === "stripe" ? "50¢ minimum card charge" : "$5 minimum for crypto network costs"}</small>
                </label>
                <fieldset>
                  <legend>Payment method</legend>
                  <button type="button" aria-pressed={provider === "stripe"} className={provider === "stripe" ? "pay-option selected" : "pay-option"} disabled={!paymentProviders.includes("stripe")} onClick={() => chooseProvider("stripe")}>
                    <span className="selection-dot" aria-hidden="true" /><strong>Card / wallet</strong><small>Stripe</small>
                  </button>
                  <button type="button" aria-pressed={provider === "nowpayments"} className={provider === "nowpayments" ? "pay-option selected" : "pay-option"} disabled={!paymentProviders.includes("nowpayments")} onClick={() => chooseProvider("nowpayments")}>
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

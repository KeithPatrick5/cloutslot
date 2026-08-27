import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cloutslot.space"),
  title: "CloutSlot — Promote your social",
  description: "A paid leaderboard for social media. Promote your Instagram, TikTok, YouTube, X, Twitch, or other social profile and rank higher with a higher bid.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "CloutSlot — Promote your social",
    description: "Get seen. Grow your social. Higher bids rank higher.",
    url: "https://cloutslot.space",
    siteName: "CloutSlot",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CloutSlot — Promote your social",
    description: "Get seen. Grow your social. Higher bids rank higher.",
  },
  other: {
    "ory-verify": "orynth-1231f5a8f3a741b68e04dca0d6787d6f",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

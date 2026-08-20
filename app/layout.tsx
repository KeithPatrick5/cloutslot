import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cloutslot.space"),
  title: "CloutSlot — The paid leaderboard",
  description: "A public market for attention. Your total bid is your rank, every listing links out, and every click is counted.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "CloutSlot — The paid leaderboard",
    description: "Pay more. Rank higher. Get seen.",
    url: "https://cloutslot.space",
    siteName: "CloutSlot",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CloutSlot — The paid leaderboard",
    description: "Pay more. Rank higher. Get seen.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

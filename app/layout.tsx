import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CloutSlot — Pay more. Sit higher. Get seen.",
  description: "A brutally simple paid leaderboard: your bid is your rank.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

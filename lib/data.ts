import { demoListings } from "./demo";
import { getAdminClient, hasLiveDatabase } from "./supabase";
import type { Listing } from "./types";

export async function getListings(): Promise<{ listings: Listing[]; demo: boolean }> {
  if (!hasLiveDatabase()) {
    return { listings: [...demoListings].sort((a, b) => b.bid_cents - a.bid_cents), demo: true };
  }

  const supabase = getAdminClient();
  if (!supabase) return { listings: demoListings, demo: true };

  const { data, error } = await supabase
    .from("listings")
    .select("id,name,tagline,url,logo_url,bid_cents,clicks,active,created_at,updated_at")
    .eq("active", true)
    .order("bid_cents", { ascending: false })
    .limit(250);

  if (error) {
    console.error("Leaderboard query failed", error);
    return { listings: demoListings, demo: true };
  }

  return { listings: (data ?? []) as Listing[], demo: false };
}

export function normalizeUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http(s) URLs are allowed.");
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname === "/") url.pathname = "";
  return url.toString().replace(/\/$/, "");
}

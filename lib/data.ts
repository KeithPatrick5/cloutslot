import { getAdminClient, hasLiveDatabase } from "./supabase";
import type { Listing } from "./types";

export type LeaderboardResult = {
  listings: Listing[];
  live: boolean;
  error?: string;
};

export async function getListings(): Promise<LeaderboardResult> {
  if (!hasLiveDatabase()) {
    return { listings: [], live: false, error: "Leaderboard database is not configured." };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { listings: [], live: false, error: "Leaderboard database is unavailable." };
  }

  const { data, error } = await supabase
    .from("listings")
    .select("id,name,tagline,url,logo_url,bid_cents,clicks,active,created_at,updated_at")
    .eq("active", true)
    .order("bid_cents", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(250);

  if (error) {
    console.error("Leaderboard query failed", error);
    return { listings: [], live: false, error: "The live leaderboard could not be loaded." };
  }

  return { listings: (data ?? []) as Listing[], live: true };
}

export function normalizeUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http(s) URLs are allowed.");
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname === "/") url.pathname = "";
  return url.toString().replace(/\/$/, "");
}

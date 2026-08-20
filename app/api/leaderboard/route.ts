import { NextResponse } from "next/server";
import { getListings } from "@/lib/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await getListings();
    return NextResponse.json(result, {
      status: result.live ? 200 : 503,
      headers: { "cache-control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Leaderboard request failed", error);
    return NextResponse.json(
      { listings: [], live: false, error: "The live leaderboard could not be loaded." },
      { status: 503, headers: { "cache-control": "no-store, max-age=0" } },
    );
  }
}

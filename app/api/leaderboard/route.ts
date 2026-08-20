import { NextResponse } from "next/server";
import { getListings } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getListings();
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}

import { NextResponse } from "next/server";
import { demoListings } from "@/lib/demo";
import { getAdminClient, hasLiveDatabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!hasLiveDatabase()) {
    const item = demoListings.find((listing) => listing.id === id);
    return NextResponse.redirect(item?.url ?? "/", 302);
  }

  const supabase = getAdminClient()!;
  const { data, error } = await supabase.from("listings").select("id,url,active").eq("id", id).maybeSingle();
  if (error || !data || !data.active) return NextResponse.redirect(new URL("/", request.url), 302);

  const { error: clickError } = await supabase.rpc("register_listing_click", { p_listing_id: id });
  if (clickError) console.error("Click increment failed", clickError);
  return NextResponse.redirect(data.url, 302);
}

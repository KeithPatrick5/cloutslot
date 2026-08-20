import { NextResponse } from "next/server";
import { getAdminClient, hasLiveDatabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!hasLiveDatabase()) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.redirect(new URL("/", request.url), 302);

  const { data, error } = await supabase
    .from("listings")
    .select("id,url,active")
    .eq("id", id)
    .maybeSingle();

  if (error || !data || !data.active) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const { error: clickError } = await supabase.rpc("register_listing_click", { p_listing_id: id });
  if (clickError) console.error("Click increment failed", clickError);

  return NextResponse.redirect(data.url, 302);
}

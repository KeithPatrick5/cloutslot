import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VISITOR_COOKIE = "cloutslot_visitor";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type VisitStats = {
  online_visitors?: number;
  visitors_last_hour?: number;
  total_visitors?: number;
  total_pageviews?: number;
};

export async function POST(request: NextRequest) {
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { available: false },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const existingId = request.cookies.get(VISITOR_COOKIE)?.value ?? "";
  const visitorId = UUID_PATTERN.test(existingId) ? existingId : randomUUID();

  let path = "/";
  let isPageview = false;
  try {
    const body = await request.json();
    if (typeof body.path === "string") path = body.path.slice(0, 200);
    isPageview = body.kind === "pageview";
  } catch {
    // A heartbeat without a JSON body is still a valid visit.
  }

  const { data, error } = await supabase.rpc("register_site_visit", {
    p_visitor_id: visitorId,
    p_path: path,
    p_is_pageview: isPageview,
  });

  if (error) {
    console.error("Site analytics registration failed", {
      code: error.code || "unknown",
      message: error.message || "Unknown Supabase error",
    });
    return NextResponse.json(
      { available: false },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as VisitStats | null;
  const response = NextResponse.json(
    {
      available: true,
      online: Number(row?.online_visitors ?? 0),
      lastHour: Number(row?.visitors_last_hour ?? 0),
      totalVisitors: Number(row?.total_visitors ?? 0),
      totalPageviews: Number(row?.total_pageviews ?? 0),
    },
    { headers: { "cache-control": "no-store" } },
  );

  if (visitorId !== existingId) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

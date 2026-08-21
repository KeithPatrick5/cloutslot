import { NextResponse } from "next/server";
import { resolveSocialProfile, type SocialPlatformId } from "@/lib/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .trim();
}

function metaContent(html: string, keys: string[]) {
  const tags = html.match(/<meta\s+[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const key = tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (!key || !keys.includes(key)) continue;
    const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
    if (content) return decodeEntities(content);
  }
  return "";
}

function cleanTitle(title: string, fallback: string) {
  if (!title) return fallback;
  const cleaned = title
    .replace(/\s*[|·–-]\s*(Instagram|TikTok|YouTube|X|Twitter|Twitch|Threads).*$/i, "")
    .replace(/\s*\(@[^)]+\)\s*$/i, "")
    .trim();
  return cleaned.slice(0, 60) || fallback;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const platform = String(body.platform || "instagram") as SocialPlatformId;
    const value = String(body.value || "");
    const profile = resolveSocialProfile(value, platform);

    let title = "";
    let description = "";
    let metadataFound = false;

    try {
      const response = await fetch(profile.url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.8",
          "user-agent": "Mozilla/5.0 (compatible; CloutSlotProfilePreview/1.0; +https://cloutslot.space)",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(5500),
        cache: "no-store",
      });

      if (response.ok) {
        const html = (await response.text()).slice(0, 750_000);
        title = metaContent(html, ["og:title", "twitter:title"]);
        description = metaContent(html, ["og:description", "twitter:description", "description"]);
        metadataFound = Boolean(title || description);
      }
    } catch {
      // Social networks frequently restrict automated profile requests. The
      // username-derived preview and avatar resolver remain valid fallbacks.
    }

    return NextResponse.json(
      {
        profile: {
          ...profile,
          name: cleanTitle(title, profile.handle),
          tagline: description.slice(0, 120) || `Follow ${profile.handle} on ${profile.platformLabel}.`,
          metadataFound,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read that profile." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
}


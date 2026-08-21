export const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram", host: "instagram.com", avatarProvider: "instagram" },
  { id: "tiktok", label: "TikTok", host: "tiktok.com", avatarProvider: "tiktok" },
  { id: "youtube", label: "YouTube", host: "youtube.com", avatarProvider: "youtube" },
  { id: "x", label: "X", host: "x.com", avatarProvider: "x" },
  { id: "twitch", label: "Twitch", host: "twitch.tv", avatarProvider: "twitch" },
  { id: "threads", label: "Threads", host: "threads.net", avatarProvider: null },
] as const;

export type SocialPlatformId = (typeof SOCIAL_PLATFORMS)[number]["id"];

export type ResolvedSocialProfile = {
  platform: SocialPlatformId;
  platformLabel: string;
  handle: string;
  username: string;
  url: string;
  avatarUrl: string;
};

const PLATFORM_HOSTS: Record<SocialPlatformId, string[]> = {
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  youtube: ["youtube.com", "youtu.be"],
  x: ["x.com", "twitter.com"],
  twitch: ["twitch.tv"],
  threads: ["threads.net"],
};

function normalizedHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
}

export function detectSocialPlatform(value: string): SocialPlatformId | null {
  try {
    const hostname = normalizedHostname(new URL(value).hostname);
    const match = SOCIAL_PLATFORMS.find(({ id }) =>
      PLATFORM_HOSTS[id].some((host) => hostname === host || hostname.endsWith(`.${host}`)),
    );
    return match?.id ?? null;
  } catch {
    return null;
  }
}

function cleanUsername(value: string) {
  const username = value
    .trim()
    .replace(/^@/, "")
    .split(/[/?#]/, 1)[0]
    .trim();

  if (!username || !/^[a-zA-Z0-9._-]{1,100}$/.test(username)) {
    throw new Error("Enter a valid social username or paste the full profile URL.");
  }

  return username;
}

function usernameFromUrl(url: URL, platform: SocialPlatformId) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (platform === "youtube" && ["channel", "c", "user"].includes(parts[0] ?? "")) {
    return cleanUsername(parts[1] ?? "");
  }
  return cleanUsername(parts[0] ?? "");
}

function profileUrl(platform: SocialPlatformId, username: string) {
  const encoded = encodeURIComponent(username);
  switch (platform) {
    case "instagram": return `https://www.instagram.com/${encoded}/`;
    case "tiktok": return `https://www.tiktok.com/@${encoded}`;
    case "youtube": return `https://www.youtube.com/@${encoded}`;
    case "x": return `https://x.com/${encoded}`;
    case "twitch": return `https://www.twitch.tv/${encoded}`;
    case "threads": return `https://www.threads.net/@${encoded}`;
  }
}

export function resolveSocialProfile(value: string, selectedPlatform: SocialPlatformId): ResolvedSocialProfile {
  const raw = value.trim();
  if (!raw) throw new Error("Enter your social username or profile URL.");

  const detectedPlatform = detectSocialPlatform(raw);
  const platform = detectedPlatform ?? selectedPlatform;
  const config = SOCIAL_PLATFORMS.find((item) => item.id === platform)!;

  let username: string;
  let url: string;

  if (detectedPlatform) {
    const parsed = new URL(raw);
    username = usernameFromUrl(parsed, detectedPlatform);
    url = profileUrl(detectedPlatform, username);
  } else {
    username = cleanUsername(raw);
    url = profileUrl(platform, username);
  }

  const handle = `@${username}`;
  const avatarUrl = config.avatarProvider
    ? `https://unavatar.io/${config.avatarProvider}/${encodeURIComponent(username)}`
    : "";

  return {
    platform,
    platformLabel: config.label,
    handle,
    username,
    url,
    avatarUrl,
  };
}


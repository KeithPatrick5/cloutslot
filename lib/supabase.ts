import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ujiojxkywwcrfmagigpl.supabase.co";

export function hasLiveDatabase() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

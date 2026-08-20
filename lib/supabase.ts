import { createClient } from "@supabase/supabase-js";

function serverEnv(name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  return process.env[name]?.trim() ?? "";
}

export function hasLiveDatabase() {
  return Boolean(serverEnv("SUPABASE_URL") && serverEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export function getAdminClient() {
  const url = serverEnv("SUPABASE_URL");
  const key = serverEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

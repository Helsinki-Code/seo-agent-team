import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseServerClient() {
  const url = supabaseUrl;
  const serviceKey = supabaseServiceRoleKey;

  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured for the dashboard.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false }
  });
}

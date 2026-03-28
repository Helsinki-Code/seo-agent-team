import { createClient } from "@supabase/supabase-js";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const sections = token.split(".");
  if (sections.length < 2) {
    return null;
  }
  const payload = sections[1];
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getSupabaseBrowserClient(accessToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
  }
  const anonPayload = decodeJwtPayload(anonKey);
  if (anonPayload?.role === "service_role") {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY must not be a service_role key.");
  }

  return createClient(url, anonKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      : undefined
  });
}

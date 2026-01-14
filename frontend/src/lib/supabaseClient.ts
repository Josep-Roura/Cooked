import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const isSupabaseConfigured = Boolean(url && anonKey);

let _supabase: SupabaseClient | null = null;
if (isSupabaseConfigured) {
  _supabase = createClient(url, anonKey);
} else {
  // Running without Supabase configured (dev). Avoid throwing so pages can render.
  // Consumers should handle a null supabase (e.g., disable auth features).
  // console.warn("Supabase not configured for frontend (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY)");
}

export const supabase = _supabase;
export { isSupabaseConfigured };

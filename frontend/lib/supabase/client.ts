import { createBrowserClient } from "@supabase/ssr"

// Singleton pattern to prevent multiple client instances
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    )
  }

  return { supabaseUrl, supabaseAnonKey }
}

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()

  supabaseClient = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
  )

  return supabaseClient
}

export const supabase = getSupabaseClient()

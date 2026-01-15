import type { OnboardingProfileInput, ProfileRow } from "@/lib/db/types"
import { fetchProfile, upsertProfileFromOnboarding } from "@/lib/db/queries"
import { supabase } from "@/lib/supabase/client"

export async function getUserProfile(): Promise<ProfileRow | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return fetchProfile(user.id)
}

export async function saveUserProfile(data: OnboardingProfileInput): Promise<ProfileRow> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error("Not authenticated")
  }

  return upsertProfileFromOnboarding(user.id, data, user.email ?? null)
}

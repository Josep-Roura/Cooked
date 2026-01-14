const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ""

export interface UserProfile {
  // Personal
  full_name: string
  email: string
  gender?: string
  birthdate?: string
  height_cm?: number
  weight_kg: number
  country?: string
  timezone?: string
  units: "metric" | "imperial"

  // Goals
  primary_goal: string
  target_weight_kg?: number
  event_name?: string
  event_date?: string
  weekly_training_hours_target?: number
  experience_level: string

  // Training profile
  sports: string[]
  weekly_sessions_swim?: number
  weekly_sessions_bike?: number
  weekly_sessions_run?: number
  weekly_sessions_gym?: number
  intensity_preference: string
  long_session_day?: string
  typical_workout_time: string
  days_off_preference: string[]

  // Nutrition preferences
  diet_type: string
  allergies: string[]
  dislikes?: string
  meals_per_day: number
  caffeine: string
  hydration_focus: boolean

  // Constraints
  cooking_time_per_day: string
  budget_level: string
  kitchen_access: string
  travel_frequency: string

  // App usage
  connect_trainingpeaks: boolean
  accept_terms: boolean
  data_processing_consent: boolean
}

export async function getUserProfile() {
  const res = await fetch("/api/v1/profile/me", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  })

  // ✅ No existe perfil → onboarding debe mostrarse
  if (res.status === 404) return null

  // ✅ No autenticado → forzamos login
  if (res.status === 401) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.error ?? "Not authenticated")
  }

  // ✅ Cualquier otro error → lanzar para mostrar mensaje
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.error ?? `Failed to load profile (${res.status})`)
  }

  // ✅ Perfil correcto
  return await res.json()
}

export async function saveUserProfile(data: Record<string, any>) {
  const res = await fetch("/api/v1/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.details ?? payload?.error ?? `Failed to save profile (${res.status})`)
  }

  return await res.json()
}

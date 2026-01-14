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

export async function saveUserProfile(profile: UserProfile): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/v1/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
    credentials: "include",
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to save profile" }))
    throw new Error(error.message)
  }

  return response.json()
}

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/profile/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new Error("Failed to fetch profile")
    }

    return response.json()
  } catch {
    return null
  }
}

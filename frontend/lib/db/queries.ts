import { supabase } from "@/lib/supabase/client"
import type {
  DateRangeOption,
  NutritionPlan,
  NutritionPlanRow,
  OnboardingProfileInput,
  ProfileRow,
} from "@/lib/db/types"

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseMinutes(value: string | undefined): number | null {
  if (!value) {
    return null
  }
  const match = value.match(/\d+/)
  if (!match) {
    return null
  }
  const minutes = Number(match[0])
  return Number.isFinite(minutes) ? minutes : null
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<ProfileRow>()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? null
}

type ProfileUpsert = Omit<ProfileRow, "created_at"> & { created_at?: string }

export async function upsertProfileFromOnboarding(
  userId: string,
  input: OnboardingProfileInput,
  email: string | null,
): Promise<ProfileRow> {
  const acceptTerms = Boolean(input.accept_terms)

  const payload: ProfileUpsert = {
    id: userId,
    email: email ?? input.email ?? null,
    full_name: input.full_name ?? null,
    name: input.full_name ?? null,
    avatar_url: null,
    meta: {
      gender: input.gender ?? null,
      birthdate: input.birthdate ?? null,
      country: input.country ?? null,
      timezone: input.timezone ?? null,
      target_weight_kg: input.target_weight_kg ?? null,
      event_date: input.event_date ?? null,
      weekly_training_hours_target: input.weekly_training_hours_target ?? null,
      weekly_sessions_swim: input.weekly_sessions_swim ?? null,
      weekly_sessions_bike: input.weekly_sessions_bike ?? null,
      weekly_sessions_run: input.weekly_sessions_run ?? null,
      weekly_sessions_gym: input.weekly_sessions_gym ?? null,
      intensity_preference: input.intensity_preference ?? null,
      long_session_day: input.long_session_day ?? null,
      days_off_preference: input.days_off_preference ?? null,
      allergies: input.allergies ?? null,
      dislikes: input.dislikes ?? null,
      caffeine: input.caffeine ?? null,
      hydration_focus: input.hydration_focus ?? null,
      travel_frequency: input.travel_frequency ?? null,
      data_processing_consent: input.data_processing_consent ?? null,
    },
    height_cm: toNumberOrNull(input.height_cm),
    weight_kg: toNumberOrNull(input.weight_kg),
    units: input.units ?? "metric",
    primary_goal: input.primary_goal ?? null,
    experience_level: input.experience_level ?? null,
    event: input.event_name ?? null,
    sports: Array.isArray(input.sports) ? input.sports : [],
    workout_time: input.typical_workout_time ?? null,
    diet: input.diet_type ?? null,
    meals_per_day: toNumberOrNull(input.meals_per_day),
    cooking_time_min: parseMinutes(input.cooking_time_per_day),
    budget: input.budget_level ?? null,
    kitchen: input.kitchen_access ?? null,
    trainingpeaks_connected: Boolean(input.trainingpeaks_connected),
    updated_at: new Date().toISOString(),
    accept_terms: acceptTerms,
    accept_terms_at: acceptTerms ? new Date().toISOString() : null,
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single<ProfileRow>()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error("Failed to save profile")
  }

  return data
}

export async function fetchNutritionPlans(userId: string): Promise<NutritionPlan[]> {
  const { data, error } = await supabase
    .from("nutrition_plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function fetchNutritionPlanRowsByPlanId(planId: string): Promise<NutritionPlanRow[]> {
  const { data, error } = await supabase
    .from("nutrition_plan_rows")
    .select("*")
    .eq("plan_id", planId)
    .order("date", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function fetchNutritionPlanRowsByDateRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<NutritionPlanRow[]> {
  const { data, error } = await supabase
    .from("nutrition_plan_rows")
    .select("*")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function fetchActivePlanByDate(
  userId: string,
  date: string,
): Promise<NutritionPlan | null> {
  const { data, error } = await supabase
    .from("nutrition_plans")
    .select("*")
    .eq("user_id", userId)
    .lte("start_date", date)
    .gte("end_date", date)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<NutritionPlan>()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? null
}

export function getDateRange(range: DateRangeOption, now: Date = new Date()) {
  const end = new Date(now)
  const start = new Date(now)

  if (range === "week") {
    start.setDate(start.getDate() - 6)
  }

  if (range === "month") {
    start.setDate(start.getDate() - 29)
  }

  return { start, end }
}

import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v)
  return null
}

function parseOptionalNumber(value: unknown): { value: number | null; error?: string } {
  if (value === undefined || value === null || value === "") {
    return { value: null }
  }
  const numeric = toNumberOrNull(value)
  if (numeric === null) {
    return { value: null, error: "Invalid number" }
  }
  return { value: numeric }
}

function validateRange(value: number | null, min: number, max: number, label: string) {
  if (value === null) return null
  if (value < min || value > max) {
    return `${label} must be between ${min} and ${max}`
  }
  return null
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated", details: authError?.message ?? null },
        { status: 401 }
      )
    }

    // ====== MAPEOS DEL FORMULARIO (onboarding.tsx) -> columnas reales en public.profiles ======
    const full_name = (body as any).full_name ?? null
    const name = (body as any).name ?? full_name ?? null
    const email = (body as any).email ?? null

    const heightParsed = parseOptionalNumber((body as any).height_cm)
    if (heightParsed.error) {
      return NextResponse.json({ error: "height_cm must be a number" }, { status: 400 })
    }
    const heightRangeError = validateRange(heightParsed.value, 100, 230, "height_cm")
    if (heightRangeError) {
      return NextResponse.json({ error: heightRangeError }, { status: 400 })
    }
    const height_cm = heightParsed.value

    const weightParsed = parseOptionalNumber((body as any).weight_kg)
    if (weightParsed.error) {
      return NextResponse.json({ error: "weight_kg must be a number" }, { status: 400 })
    }
    const weightRangeError = validateRange(weightParsed.value, 20, 250, "weight_kg")
    if (weightRangeError) {
      return NextResponse.json({ error: weightRangeError }, { status: 400 })
    }
    const weight_kg = weightParsed.value

    const units = (body as any).units ?? "metric"
    if (units !== "metric" && units !== "imperial") {
      return NextResponse.json({ error: "units must be 'metric' or 'imperial'" }, { status: 400 })
    }
    const primary_goal = (body as any).primary_goal ?? null
    const experience_level = (body as any).experience_level ?? null

    // tu schema usa event (columna), pero el form usa event_name
    const event = (body as any).event_name ?? (body as any).event ?? null

    // sports ya existe como text[]
    const sports = Array.isArray((body as any).sports) ? (body as any).sports : []

    // columna workout_time, el form usa typical_workout_time
    const workout_time = (body as any).typical_workout_time ?? null

    // columna diet, el form usa diet_type
    const diet = (body as any).diet_type ?? null

    const mealsParsed = parseOptionalNumber((body as any).meals_per_day)
    if (mealsParsed.error) {
      return NextResponse.json({ error: "meals_per_day must be a number" }, { status: 400 })
    }
    const mealsRangeError = validateRange(mealsParsed.value, 1, 10, "meals_per_day")
    if (mealsRangeError) {
      return NextResponse.json({ error: mealsRangeError }, { status: 400 })
    }
    const meals_per_day = mealsParsed.value

    // columna cooking_time_min es int; el form usa string "cooking_time_per_day"
    // -> no lo parseamos a int porque puede venir como "15-30", lo guardamos en meta
    const cookingParsed = parseOptionalNumber((body as any).cooking_time_min)
    if (cookingParsed.error) {
      return NextResponse.json({ error: "cooking_time_min must be a number" }, { status: 400 })
    }
    const cookingRangeError = validateRange(cookingParsed.value, 0, 600, "cooking_time_min")
    if (cookingRangeError) {
      return NextResponse.json({ error: cookingRangeError }, { status: 400 })
    }
    const cooking_time_min = cookingParsed.value

    // budget/kitchen existen, pero el form usa budget_level/kitchen_access
    const budget = (body as any).budget_level ?? (body as any).budget ?? null
    const kitchen = (body as any).kitchen_access ?? (body as any).kitchen ?? null

    const trainingpeaks_connected =
      Boolean((body as any).connect_trainingpeaks ?? (body as any).trainingpeaks_connected ?? false)

    const accept_terms = Boolean((body as any).accept_terms ?? false)
    const accept_terms_at = accept_terms ? new Date().toISOString() : null

    // ====== TODO lo demás del form lo guardamos en meta ======
    // (así tu BD no se rompe por columnas que no existen)
    const meta = {
      gender: (body as any).gender ?? null,
      birthdate: (body as any).birthdate ?? null,
      country: (body as any).country ?? null,
      timezone: (body as any).timezone ?? null,

      target_weight_kg: (body as any).target_weight_kg ?? null,
      event_date: (body as any).event_date ?? null,
      weekly_training_hours_target: (body as any).weekly_training_hours_target ?? null,

      weekly_sessions_swim: (body as any).weekly_sessions_swim ?? null,
      weekly_sessions_bike: (body as any).weekly_sessions_bike ?? null,
      weekly_sessions_run: (body as any).weekly_sessions_run ?? null,
      weekly_sessions_gym: (body as any).weekly_sessions_gym ?? null,

      intensity_preference: (body as any).intensity_preference ?? null,
      long_session_day: (body as any).long_session_day ?? null,
      days_off_preference: (body as any).days_off_preference ?? null,

      allergies: (body as any).allergies ?? null,
      dislikes: (body as any).dislikes ?? null,
      caffeine: (body as any).caffeine ?? null,
      hydration_focus: (body as any).hydration_focus ?? null,

      cooking_time_per_day: (body as any).cooking_time_per_day ?? null,
      travel_frequency: (body as any).travel_frequency ?? null,
      data_processing_consent: (body as any).data_processing_consent ?? null,
    }

    const payload = {
      id: user.id,
      name,
      email,
      full_name,
      height_cm,
      weight_kg,
      units,
      primary_goal,
      experience_level,
      event,
      sports,
      workout_time,
      diet,
      meals_per_day: meals_per_day ?? null,
      cooking_time_min,
      budget,
      kitchen,
      trainingpeaks_connected,
      accept_terms,
      accept_terms_at,
      meta,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single()

    if (error) {
      console.error("POST /api/v1/profile supabase error:", error)
      return NextResponse.json(
        { error: "Database error", details: error.message, code: error.code },
        { status: 400 }
      )
    }

    return NextResponse.json(data, { status: 200 })
  } catch (e: any) {
    console.error("POST /api/v1/profile error:", e)
    return NextResponse.json(
      { error: "Internal error", details: e?.message ?? String(e) },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createServerClient()

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated", details: authError?.message ?? null },
        { status: 401 }
      )
    }

    const updates: Record<string, unknown> = {}

    if (Object.prototype.hasOwnProperty.call(body, "full_name")) {
      const value = (body as any).full_name
      if (value === null) {
        updates.full_name = null
        updates.name = null
      } else if (typeof value === "string") {
        const trimmed = value.trim()
        updates.full_name = trimmed.length > 0 ? trimmed : null
        updates.name = trimmed.length > 0 ? trimmed : null
      } else {
        return NextResponse.json({ error: "full_name must be a string or null" }, { status: 400 })
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "avatar_url")) {
      const value = (body as any).avatar_url
      if (value === null || typeof value === "string") {
        updates.avatar_url = value === "" ? null : value
      } else {
        return NextResponse.json({ error: "avatar_url must be a string or null" }, { status: 400 })
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "units")) {
      const value = (body as any).units
      if (value !== "metric" && value !== "imperial") {
        return NextResponse.json({ error: "units must be 'metric' or 'imperial'" }, { status: 400 })
      }
      updates.units = value
    }

    const stringFields = [
      "primary_goal",
      "experience_level",
      "event",
      "workout_time",
      "diet",
      "budget",
      "kitchen",
    ]

    for (const field of stringFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        const value = (body as any)[field]
        if (value === null || typeof value === "string") {
          updates[field] = value === "" ? null : value
        } else {
          return NextResponse.json({ error: `${field} must be a string or null` }, { status: 400 })
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "sports")) {
      const value = (body as any).sports
      if (value === null) {
        updates.sports = null
      } else if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
        updates.sports = value
      } else {
        return NextResponse.json({ error: "sports must be an array of strings" }, { status: 400 })
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "height_cm")) {
      const parsed = parseOptionalNumber((body as any).height_cm)
      if (parsed.error) {
        return NextResponse.json({ error: "height_cm must be a number" }, { status: 400 })
      }
      const rangeError = validateRange(parsed.value, 100, 230, "height_cm")
      if (rangeError) {
        return NextResponse.json({ error: rangeError }, { status: 400 })
      }
      updates.height_cm = parsed.value
    }

    if (Object.prototype.hasOwnProperty.call(body, "weight_kg")) {
      const parsed = parseOptionalNumber((body as any).weight_kg)
      if (parsed.error) {
        return NextResponse.json({ error: "weight_kg must be a number" }, { status: 400 })
      }
      const rangeError = validateRange(parsed.value, 20, 250, "weight_kg")
      if (rangeError) {
        return NextResponse.json({ error: rangeError }, { status: 400 })
      }
      updates.weight_kg = parsed.value
    }

    if (Object.prototype.hasOwnProperty.call(body, "meals_per_day")) {
      const parsed = parseOptionalNumber((body as any).meals_per_day)
      if (parsed.error) {
        return NextResponse.json({ error: "meals_per_day must be a number" }, { status: 400 })
      }
      const rangeError = validateRange(parsed.value, 1, 10, "meals_per_day")
      if (rangeError) {
        return NextResponse.json({ error: rangeError }, { status: 400 })
      }
      updates.meals_per_day = parsed.value
    }

    if (Object.prototype.hasOwnProperty.call(body, "cooking_time_min")) {
      const parsed = parseOptionalNumber((body as any).cooking_time_min)
      if (parsed.error) {
        return NextResponse.json({ error: "cooking_time_min must be a number" }, { status: 400 })
      }
      const rangeError = validateRange(parsed.value, 0, 600, "cooking_time_min")
      if (rangeError) {
        return NextResponse.json({ error: rangeError }, { status: 400 })
      }
      updates.cooking_time_min = parsed.value
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const payload = {
      id: user.id,
      email: user.email ?? null,
      updated_at: new Date().toISOString(),
      ...updates,
    }

    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single()

    if (error) {
      console.error("PATCH /api/v1/profile supabase error:", error)
      return NextResponse.json(
        { error: "Database error", details: error.message, code: error.code },
        { status: 400 }
      )
    }

    return NextResponse.json(data, { status: 200 })
  } catch (e: any) {
    console.error("PATCH /api/v1/profile error:", e)
    return NextResponse.json(
      { error: "Internal error", details: e?.message ?? String(e) },
      { status: 500 }
    )
  }
}

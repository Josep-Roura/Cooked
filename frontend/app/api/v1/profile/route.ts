import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v)
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
      error: authError
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

    const height_cm = toNumberOrNull((body as any).height_cm)
    const weight_kg = toNumberOrNull((body as any).weight_kg)

    const units = (body as any).units ?? "metric"
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

    const meals_per_day = toNumberOrNull((body as any).meals_per_day)

    // columna cooking_time_min es int; el form usa string "cooking_time_per_day"
    // -> no lo parseamos a int porque puede venir como "15-30", lo guardamos en meta
    const cooking_time_min = toNumberOrNull((body as any).cooking_time_min)

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
      data_processing_consent: (body as any).data_processing_consent ?? null
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
      updated_at: new Date().toISOString()
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

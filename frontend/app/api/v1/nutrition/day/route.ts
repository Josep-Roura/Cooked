import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import type { Meal, NutritionDayPlan, NutritionMacros } from "@/lib/db/types"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

type NutritionMetaEntry = {
  meals?: Meal[]
  macros?: NutritionMacros
  day_type?: string
  meals_per_day?: number
}

function parseNutritionMeta(meta: Record<string, unknown> | null | undefined, date: string): NutritionMetaEntry | null {
  if (!meta || typeof meta !== "object") return null
  const raw = (meta as Record<string, unknown>)["nutrition_by_date"]
  if (!raw || typeof raw !== "object") return null
  const entry = (raw as Record<string, NutritionMetaEntry>)[date]
  return entry ?? null
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const date = url.searchParams.get("date")

    if (!date || !DATE_REGEX.test(date)) {
      return NextResponse.json({ error: "Invalid or missing date (YYYY-MM-DD required)." }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated", details: authError?.message ?? null }, { status: 401 })
    }

    const { data: rows, error: rowError } = await supabase
      .from("nutrition_plan_rows")
      .select("id, plan_id, date, day_type, kcal, protein_g, carbs_g, fat_g, intra_cho_g_per_h, created_at")
      .eq("user_id", user.id)
      .eq("date", date)
      .order("created_at", { ascending: false })
      .limit(1)

    if (rowError) {
      return NextResponse.json({ error: "Database error", details: rowError.message, code: rowError.code }, { status: 400 })
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ exists: false }, { status: 404 })
    }

    const row = rows[0]

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("meta, meals_per_day")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json(
        { error: "Profile lookup failed", details: profileError.message, code: profileError.code },
        { status: 400 },
      )
    }

    const metaEntry = parseNutritionMeta(profile?.meta ?? null, date)
    const meals = Array.isArray(metaEntry?.meals) ? metaEntry?.meals ?? [] : []
    const mealsPerDay = metaEntry?.meals_per_day ?? profile?.meals_per_day ?? meals.length

    const macros: NutritionMacros = {
      kcal: row.kcal,
      protein_g: row.protein_g,
      carbs_g: row.carbs_g,
      fat_g: row.fat_g,
      intra_cho_g_per_h: row.intra_cho_g_per_h,
    }

    // normaliza day_type para UI
    const normalizedDayType =
      row.day_type === "high" || row.day_type === "rest" || row.day_type === "training" ? row.day_type : "training"

    const payload: NutritionDayPlan = {
      plan_id: row.plan_id ?? null,
      date: String(row.date),
      day_type: normalizedDayType,
      macros,
      meals_per_day: mealsPerDay ?? 0,
      meals,
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/nutrition/day error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

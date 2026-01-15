import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import type { Meal, NutritionMacros } from "@/lib/db/types"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

type NutritionMetaEntry = {
  meals?: Meal[]
  macros?: NutritionMacros
  day_type?: string
  meals_per_day?: number
  updated_at?: string
}

function clampDateRange(start: string, end: string) {
  if (!DATE_REGEX.test(start) || !DATE_REGEX.test(end)) {
    return null
  }
  if (start > end) {
    return null
  }
  return { start, end }
}

function parseNutritionMeta(meta: Record<string, unknown> | null | undefined) {
  if (!meta || typeof meta !== "object") {
    return {}
  }
  const raw = (meta as Record<string, unknown>)["nutrition_by_date"]
  if (!raw || typeof raw !== "object") {
    return {}
  }
  return raw as Record<string, NutritionMetaEntry>
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const start = url.searchParams.get("start")
    const end = url.searchParams.get("end")

    if (!start || !end) {
      return NextResponse.json({ error: "Missing start or end date." }, { status: 400 })
    }

    const range = clampDateRange(start, end)
    if (!range) {
      return NextResponse.json({ error: "Invalid date range (YYYY-MM-DD required)." }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated", details: authError?.message ?? null },
        { status: 401 },
      )
    }

    const { data: rows, error: rowsError } = await supabase
      .from("nutrition_plan_rows")
      .select("id, plan_id, date, day_type, kcal, protein_g, carbs_g, fat_g, intra_cho_g_per_h")
      .eq("user_id", user.id)
      .gte("date", range.start)
      .lte("date", range.end)
      .order("date", { ascending: true })

    if (rowsError) {
      return NextResponse.json(
        { error: "Database error", details: rowsError.message, code: rowsError.code },
        { status: 400 },
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("meta")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json(
        { error: "Profile lookup failed", details: profileError.message, code: profileError.code },
        { status: 400 },
      )
    }

    const nutritionMeta = parseNutritionMeta(profile?.meta ?? null)
    const mealsByDate: Record<string, NutritionMetaEntry> = {}

    Object.entries(nutritionMeta).forEach(([date, entry]) => {
      if (date < range.start || date > range.end) return
      mealsByDate[date] = entry
    })

    return NextResponse.json({ start: range.start, end: range.end, rows: rows ?? [], meals_by_date: mealsByDate }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/nutrition/range error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

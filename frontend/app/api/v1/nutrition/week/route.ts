import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { buildDateRange } from "@/lib/utils/dateRange"

const MAX_RANGE_DAYS = 7

type ErrorPayload = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

function jsonError(status: number, code: string, message: string, details?: unknown) {
  const payload: ErrorPayload = { ok: false, error: { code, message, details } }
  return NextResponse.json(payload, { status })
}

function formatDate(date: Date) {
  return date.toISOString().split("T")[0]
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const start = searchParams.get("start") ?? ""
    const end = searchParams.get("end") ?? ""

    const range = buildDateRange(start, end, MAX_RANGE_DAYS)
    if (!range) {
      return jsonError(400, "invalid_range", "Invalid date range.")
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonError(401, "unauthorized", "Not authenticated", authError?.message ?? null)
    }

    const { data: targetRows, error: targetError } = await supabase
      .from("nutrition_plan_rows")
      .select("date, kcal, protein_g, carbs_g, fat_g, intra_cho_g_per_h, created_at, day_type, locked")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)
      .order("created_at", { ascending: false })

    if (targetError) {
      return jsonError(400, "db_error", "Failed to load nutrition targets", targetError.message)
    }

    const targetMap = new Map<
      string,
      { kcal: number; protein_g: number; carbs_g: number; fat_g: number; intra_cho_g_per_h: number; locked: boolean }
    >()
    ;(targetRows ?? []).forEach((row) => {
      if (!targetMap.has(row.date)) {
        targetMap.set(row.date, {
          kcal: row.kcal ?? 0,
          protein_g: row.protein_g ?? 0,
          carbs_g: row.carbs_g ?? 0,
          fat_g: row.fat_g ?? 0,
          intra_cho_g_per_h: row.intra_cho_g_per_h ?? 0,
          locked: row.locked ?? false,
        })
      }
    })

    const consumedMap = new Map<
      string,
      { kcal: number; protein_g: number; carbs_g: number; fat_g: number; intra_cho_g_per_h: number }
    >()

    const [{ data: meals, error: mealsError }, { data: mealLog, error: logError }] = await Promise.all([
      supabase
        .from("nutrition_meals")
        .select("id, date, slot, name, meal_type, time, kcal, protein_g, carbs_g, fat_g, ingredients, recipe, eaten")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end)
        .order("time", { ascending: true, nullsFirst: false })
        .order("slot", { ascending: true }),
      supabase
        .from("meal_log")
        .select("date, slot, is_eaten")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end),
    ])

    if (mealsError || logError) {
      return jsonError(
        400,
        "db_error",
        "Failed to load meals",
        mealsError?.message ?? logError?.message ?? null,
      )
    }

    const logMap = new Map((mealLog ?? []).map((log) => [`${log.date}:${log.slot}`, log]))

    const normalizedMeals = (meals ?? []).map((meal) => ({
      ...meal,
      kcal: meal.kcal ?? 0,
      protein_g: meal.protein_g ?? 0,
      carbs_g: meal.carbs_g ?? 0,
      fat_g: meal.fat_g ?? 0,
      ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
      recipe: meal.recipe ?? null,
      meal_type: meal.meal_type ?? null,
      eaten: logMap.get(`${meal.date}:${meal.slot}`)?.is_eaten ?? meal.eaten ?? false,
      macros: {
        kcal: meal.kcal ?? 0,
        protein_g: meal.protein_g ?? 0,
        carbs_g: meal.carbs_g ?? 0,
        fat_g: meal.fat_g ?? 0,
      },
    }))

    const mealsByDate = normalizedMeals.reduce((map, meal) => {
      if (!map.has(meal.date)) {
        map.set(meal.date, [])
      }
      map.get(meal.date)?.push(meal)
      return map
    }, new Map<string, typeof normalizedMeals[number][]>())

    normalizedMeals.forEach((meal) => {
      if (!meal.eaten) return
      const current = consumedMap.get(meal.date) ?? {
        kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        intra_cho_g_per_h: 0,
      }
      consumedMap.set(meal.date, {
        kcal: current.kcal + meal.kcal,
        protein_g: current.protein_g + meal.protein_g,
        carbs_g: current.carbs_g + meal.carbs_g,
        fat_g: current.fat_g + meal.fat_g,
        intra_cho_g_per_h: 0,
      })
    })

    const days = Array.from({ length: range.days }, (_value, index) => {
      const date = new Date(range.startDate)
      date.setUTCDate(range.startDate.getUTCDate() + index)
      const dateKey = formatDate(date)
      return {
        date: dateKey,
        consumed: consumedMap.get(dateKey) ?? {
          kcal: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          intra_cho_g_per_h: 0,
        },
        target: targetMap.get(dateKey) ?? null,
        locked: targetMap.get(dateKey)?.locked ?? false,
        meals: mealsByDate.get(dateKey) ?? [],
      }
    })

    console.info("GET /api/v1/nutrition/week", {
      userId: user.id,
      start,
      end,
      count: normalizedMeals.length,
    })

    return NextResponse.json({ days }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/nutrition/week error:", error)
    return jsonError(
      500,
      "internal_error",
      "Internal error",
      error instanceof Error ? error.message : String(error),
    )
  }
}

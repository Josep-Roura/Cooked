import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_DAYS = 7

function parseDate(value: string) {
  if (!DATE_REGEX.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date
}

function buildDateRange(start: string, end: string) {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  if (!startDate || !endDate) return null
  if (start > end) return null
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (days > MAX_RANGE_DAYS) return null
  return { startDate, endDate, days }
}

function formatDate(date: Date) {
  return date.toISOString().split("T")[0]
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const start = searchParams.get("start") ?? ""
    const end = searchParams.get("end") ?? ""

    const range = buildDateRange(start, end)
    if (!range) {
      return NextResponse.json({ error: "Invalid date range." }, { status: 400 })
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

    const { data: targetRows, error: targetError } = await supabase
      .from("nutrition_plan_rows")
      .select("date, kcal, protein_g, carbs_g, fat_g, intra_cho_g_per_h, created_at, day_type")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)
      .order("created_at", { ascending: false })

    if (targetError) {
      return NextResponse.json(
        { error: "Failed to load nutrition targets", details: targetError.message },
        { status: 400 },
      )
    }

    const targetMap = new Map<
      string,
      { kcal: number; protein_g: number; carbs_g: number; fat_g: number; intra_cho_g_per_h: number }
    >()
    ;(targetRows ?? []).forEach((row) => {
      if (!targetMap.has(row.date)) {
        targetMap.set(row.date, {
          kcal: row.kcal ?? 0,
          protein_g: row.protein_g ?? 0,
          carbs_g: row.carbs_g ?? 0,
          fat_g: row.fat_g ?? 0,
          intra_cho_g_per_h: row.intra_cho_g_per_h ?? 0,
        })
      }
    })

    const consumedMap = new Map<
      string,
      { kcal: number; protein_g: number; carbs_g: number; fat_g: number; intra_cho_g_per_h: number }
    >()

    const { data: meals, error: mealsError } = await supabase
      .from("nutrition_meals")
      .select("id, date, slot, name, time, kcal, protein_g, carbs_g, fat_g, ingredients, eaten")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)

    if (mealsError) {
      return NextResponse.json({ error: "Failed to load meals", details: mealsError.message }, { status: 400 })
    }

    const normalizedMeals = (meals ?? []).map((meal) => ({
      ...meal,
      kcal: meal.kcal ?? 0,
      protein_g: meal.protein_g ?? 0,
      carbs_g: meal.carbs_g ?? 0,
      fat_g: meal.fat_g ?? 0,
      ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
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
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

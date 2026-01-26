import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_DAYS = 45 // Month grid views can span up to 6 weeks; allow up to ~45 days.

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
  if (days < 1 || days > MAX_RANGE_DAYS) return null
  return { start, end, days }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const start = url.searchParams.get("start")
    const end = url.searchParams.get("end")

    if (!start || !end) {
      return NextResponse.json({ error: "Missing start or end date." }, { status: 400 })
    }

    const range = buildDateRange(start, end)
    if (!range) {
      return NextResponse.json(
        { error: `Invalid date range (YYYY-MM-DD required, max ${MAX_RANGE_DAYS} days).` },
        { status: 400 },
      )
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

    const { data: meals, error } = await supabase
      .from("nutrition_meals")
      .select(
        "id, date, slot, name, time, kcal, protein_g, carbs_g, fat_g, ingredients, eaten, eaten_at, recipe",
      )
      .eq("user_id", user.id)
      .gte("date", range.start)
      .lte("date", range.end)
      .order("date", { ascending: true })
      .order("slot", { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: "Database error", details: error.message, code: error.code },
        { status: 400 },
      )
    }

    const normalizedMeals = (meals ?? []).map((meal) => ({
      id: meal.id,
      date: meal.date,
      slot: meal.slot,
      name: meal.name,
      time: meal.time,
      kcal: meal.kcal ?? 0,
      protein_g: meal.protein_g ?? 0,
      carbs_g: meal.carbs_g ?? 0,
      fat_g: meal.fat_g ?? 0,
      ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
      eaten: meal.eaten ?? false,
      eaten_at: meal.eaten_at ?? null,
      recipe: meal.recipe ?? null,
      macros: {
        kcal: meal.kcal ?? 0,
        protein_g: meal.protein_g ?? 0,
        carbs_g: meal.carbs_g ?? 0,
        fat_g: meal.fat_g ?? 0,
      },
    }))

    console.info("GET /api/v1/nutrition/range", {
      userId: user.id,
      start: range.start,
      end: range.end,
      count: normalizedMeals.length,
    })

    return NextResponse.json({ start: range.start, end: range.end, meals: normalizedMeals }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/nutrition/range error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

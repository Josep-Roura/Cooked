import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_DAYS = 90

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
      return jsonError(400, "missing_dates", "Missing start or end date.")
    }

    const range = buildDateRange(start, end)
    if (!range) {
      return jsonError(
        400,
        "invalid_range",
        `Invalid date range (YYYY-MM-DD required, max ${MAX_RANGE_DAYS} days).`,
      )
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonError(401, "unauthorized", "Not authenticated", authError?.message ?? null)
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
      return jsonError(400, "db_error", "Database error", error.message)
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
    return jsonError(
      500,
      "internal_error",
      "Internal error",
      error instanceof Error ? error.message : String(error),
    )
  }
}

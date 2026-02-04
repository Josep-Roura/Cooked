import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get("date") ?? ""
    if (!DATE_REGEX.test(date)) {
      return jsonError(400, "invalid_date", "Invalid date.")
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonError(401, "unauthorized", "Not authenticated", authError?.message ?? null)
    }

    const { data: meals, error: mealsError } = await supabase
      .from("nutrition_meals")
      .select(
        "id, date, slot, meal_type, emoji, name, time, kcal, protein_g, carbs_g, fat_g, eaten, created_at, updated_at, ingredients, recipe, notes, locked",
      )
      .eq("user_id", user.id)
      .eq("date", date)
      .order("time", { ascending: true, nullsFirst: false })
      .order("slot", { ascending: true })

    if (mealsError) {
      return jsonError(400, "db_error", "Failed to load meals", mealsError.message)
    }

    const items = (meals ?? [])
      .sort((a, b) => {
        const timeA = a.time ?? ""
        const timeB = b.time ?? ""
        if (timeA && timeB && timeA !== timeB) return timeA.localeCompare(timeB)
        if (timeA && !timeB) return -1
        if (!timeA && timeB) return 1
        return (a.slot ?? 0) - (b.slot ?? 0)
      })
      .map((meal, index) => ({
      id: `${meal.date}:${meal.slot}`,
      meal_plan_id: meal.id,
      slot: meal.slot,
      meal_type: meal.meal_type ?? null,
      sort_order: index + 1,
      name: meal.name,
      time: meal.time,
      emoji: meal.emoji ?? null,
      kcal: meal.kcal ?? 0,
      protein_g: meal.protein_g ?? 0,
      carbs_g: meal.carbs_g ?? 0,
      fat_g: meal.fat_g ?? 0,
      eaten: meal.eaten ?? false,
      notes: meal.notes ?? null,
      recipe_id: null,
      created_at: meal.created_at,
      updated_at: meal.updated_at,
      ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
      recipe: meal.recipe ?? null,
      locked: meal.locked ?? false,
    }))

    console.info("GET /api/v1/meals/day", {
      userId: user.id,
      date,
      rowsCount: items.length,
      source: "nutrition_meals",
    })
    return NextResponse.json({ plan: null, items, source: "nutrition_meals" }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/meals/day error:", error)
    return jsonError(
      500,
      "internal_error",
      "Internal error",
      error instanceof Error ? error.message : String(error),
    )
  }
}

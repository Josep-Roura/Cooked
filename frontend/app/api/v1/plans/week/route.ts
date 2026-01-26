import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const start = searchParams.get("start") ?? ""
    const end = searchParams.get("end") ?? ""

    if (!DATE_REGEX.test(start) || !DATE_REGEX.test(end) || start > end) {
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

    const { data: meals, error } = await supabase
      .from("nutrition_meals")
      .select("id, date, slot, name, time, macros, created_at, updated_at")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .order("slot", { ascending: true })

    if (error) {
      return NextResponse.json({ error: "Failed to load plan meals", details: error.message }, { status: 400 })
    }

    const hydratedMeals = (meals ?? []).map((meal) => ({
      id: `${meal.date}:${meal.slot}`,
      meal_plan_id: meal.id,
      date: meal.date,
      slot: meal.slot,
      meal_type: null,
      sort_order: meal.slot,
      name: meal.name,
      time: meal.time,
      emoji: null,
      kcal: meal.macros?.kcal ?? 0,
      protein_g: meal.macros?.protein_g ?? 0,
      carbs_g: meal.macros?.carbs_g ?? 0,
      fat_g: meal.macros?.fat_g ?? 0,
      notes: null,
      recipe_id: null,
      created_at: meal.created_at,
      updated_at: meal.updated_at,
      recipe: null,
      recipe_ingredients: [],
    }))

    return NextResponse.json({ meals: hydratedMeals }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/plans/week error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

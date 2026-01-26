import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get("date") ?? ""
    if (!DATE_REGEX.test(date)) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 })
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

    const { data: meals, error: mealsError } = await supabase
      .from("nutrition_meals")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .order("time", { ascending: true, nullsFirst: false })
      .order("slot", { ascending: true })

    if (mealsError) {
      return NextResponse.json({ error: "Failed to load meals", details: mealsError.message }, { status: 400 })
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
      meal_type: null,
      sort_order: index + 1,
      name: meal.name,
      time: meal.time,
      emoji: null,
      kcal: meal.kcal ?? 0,
      protein_g: meal.protein_g ?? 0,
      carbs_g: meal.carbs_g ?? 0,
      fat_g: meal.fat_g ?? 0,
      eaten: meal.eaten ?? false,
      notes: null,
      recipe_id: null,
      created_at: meal.created_at,
      updated_at: meal.updated_at,
      ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
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
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

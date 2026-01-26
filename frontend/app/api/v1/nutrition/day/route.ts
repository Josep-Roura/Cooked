import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import type { Meal, NutritionDayPlan, NutritionMacros, NutritionDayType } from "@/lib/db/types"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function normalizeDayType(value: string | null | undefined): NutritionDayType {
  if (value === "high" || value === "rest" || value === "training") {
    return value
  }
  return "rest"
}

function buildMeals(meals: any[]): Meal[] {
  return meals.map((meal) => ({
    slot: meal.slot,
    name: meal.name,
    time: meal.time ?? "",
    kcal: meal.macros?.kcal ?? 0,
    protein_g: meal.macros?.protein_g ?? 0,
    carbs_g: meal.macros?.carbs_g ?? 0,
    fat_g: meal.macros?.fat_g ?? 0,
    ingredients: Array.isArray(meal.ingredients) ? meal.ingredients.map((item: any) => item.name ?? "") : [],
    completed: meal.eaten ?? false,
  }))
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

    const [{ data: rows, error: rowError }, { data: meals, error: mealsError }] = await Promise.all([
      supabase
        .from("nutrition_plan_rows")
        .select("id, plan_id, date, day_type, kcal, protein_g, carbs_g, fat_g, intra_cho_g_per_h, created_at")
        .eq("user_id", user.id)
        .eq("date", date)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("nutrition_meals")
        .select("slot, name, time, macros, ingredients, eaten")
        .eq("user_id", user.id)
        .eq("date", date)
        .order("slot", { ascending: true }),
    ])

    if (rowError || mealsError) {
      return NextResponse.json(
        { error: "Database error", details: rowError?.message ?? mealsError?.message ?? "" },
        { status: 400 },
      )
    }

    if ((rows ?? []).length === 0 && (meals ?? []).length === 0) {
      return NextResponse.json({ exists: false }, { status: 404 })
    }

    const row = (rows ?? [])[0]

    const { data: profile } = await supabase
      .from("profiles")
      .select("meals_per_day")
      .eq("id", user.id)
      .maybeSingle()

    const macros: NutritionMacros = row
      ? {
          kcal: row.kcal,
          protein_g: row.protein_g,
          carbs_g: row.carbs_g,
          fat_g: row.fat_g,
          intra_cho_g_per_h: row.intra_cho_g_per_h,
        }
      : {
          kcal: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          intra_cho_g_per_h: 0,
        }

    const payload: NutritionDayPlan = {
      plan_id: row?.plan_id ?? null,
      date: date,
      day_type: normalizeDayType(row?.day_type),
      macros,
      meals_per_day: profile?.meals_per_day ?? (meals ?? []).length,
      meals: buildMeals(meals ?? []),
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

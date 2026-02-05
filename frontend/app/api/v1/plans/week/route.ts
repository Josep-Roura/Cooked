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
      .select("id, date, slot, name, time, kcal, protein_g, carbs_g, fat_g, created_at, updated_at, locked, recipe, ingredients, emoji, meal_type, notes")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .order("time", { ascending: true, nullsFirst: false })
      .order("slot", { ascending: true })

    if (error) {
      return NextResponse.json({ error: "Failed to load plan meals", details: error.message }, { status: 400 })
    }

    const hydratedMeals = (meals ?? []).map((meal: any) => {
      const ingredients = (meal.ingredients as Array<any>) ?? []
      const recipe = meal.recipe ?? null
      const normalizedRecipe =
        recipe && (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0)
          ? { ...recipe, ingredients }
          : recipe

      return {
        id: `${meal.date}:${meal.slot}`,
        meal_plan_id: meal.id,
        date: meal.date,
        slot: meal.slot,
        meal_type: meal.meal_type ?? null,
        sort_order: meal.slot,
        name: meal.name,
        time: meal.time,
        emoji: meal.emoji ?? null,
        kcal: meal.kcal ?? 0,
        protein_g: meal.protein_g ?? 0,
        carbs_g: meal.carbs_g ?? 0,
        fat_g: meal.fat_g ?? 0,
        notes: meal.notes ?? null,
        recipe_id: null,
        created_at: meal.created_at,
        updated_at: meal.updated_at,
        locked: meal.locked ?? false,
        recipe: normalizedRecipe,
        recipe_ingredients: ingredients,
      }
    })

    return NextResponse.json({ meals: hydratedMeals }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/plans/week error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

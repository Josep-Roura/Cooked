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
      .from("meal_schedule")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .order("slot", { ascending: true })

    if (error) {
      return NextResponse.json({ error: "Failed to load plan meals", details: error.message }, { status: 400 })
    }

    const recipeIds = Array.from(new Set((meals ?? []).map((meal) => meal.recipe_id).filter(Boolean)))
    let recipes: Record<string, any> = {}
    let ingredientsByRecipe = new Map<string, any[]>()

    if (recipeIds.length > 0) {
      const { data: recipeRows } = await supabase
        .from("recipes")
        .select("id, title, description, servings, macros_kcal, macros_protein_g, macros_carbs_g, macros_fat_g")
        .in("id", recipeIds)

      recipes = (recipeRows ?? []).reduce((acc, recipe) => {
        acc[recipe.id] = recipe
        return acc
      }, {} as Record<string, any>)

      const { data: ingredientRows } = await supabase
        .from("recipe_ingredients")
        .select("id, recipe_id, name, quantity, unit, optional")
        .in("recipe_id", recipeIds)

      ingredientsByRecipe = (ingredientRows ?? []).reduce((map, ingredient) => {
        if (!map.has(ingredient.recipe_id)) {
          map.set(ingredient.recipe_id, [])
        }
        map.get(ingredient.recipe_id)?.push(ingredient)
        return map
      }, new Map<string, any[]>())
    }

    const hydratedMeals = (meals ?? []).map((meal) => ({
      ...meal,
      recipe: meal.recipe_id ? recipes[meal.recipe_id] ?? null : null,
      recipe_ingredients: meal.recipe_id ? ingredientsByRecipe.get(meal.recipe_id) ?? [] : [],
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

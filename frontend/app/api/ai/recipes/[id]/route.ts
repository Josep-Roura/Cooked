import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const querySchema = z.object({
  servings: z.coerce.number().int().positive().optional(),
})

/**
 * Calculate scaled quantity based on servings
 */
function scaleQuantity(
  quantity: number,
  originalServings: number,
  newServings: number,
  unit: string
): { quantity: number; unit: string } {
  const scaleFactor = newServings / originalServings
  let scaledQuantity = quantity * scaleFactor

  const wholeUnits = ["egg", "eggs", "can", "cans", "package", "packages", "loaf", "loaves", "bulb", "bulbs", "head", "heads"]
  const isWholeUnit = wholeUnits.some((u) => unit.toLowerCase().includes(u))

  if (isWholeUnit) {
    scaledQuantity = Math.round(scaledQuantity)
    if (scaledQuantity === 0) scaledQuantity = 1
  } else {
    scaledQuantity = Math.round(scaledQuantity * 100) / 100
  }

  return { quantity: scaledQuantity, unit }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recipeId } = await context.params
    const { searchParams } = new URL(req.url)
    
    const query = querySchema.parse({
      servings: searchParams.get("servings"),
    })

    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Fetch recipe
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .select("*")
      .eq("id", recipeId)
      .eq("user_id", user.id)
      .single()

    if (recipeError || !recipe) {
      return NextResponse.json(
        { error: "Recipe not found" },
        { status: 404 }
      )
    }

    // Fetch ingredients
    const { data: ingredients, error: ingredientError } = await supabase
      .from("recipe_ingredients")
      .select("*")
      .eq("recipe_id", recipeId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })

    if (ingredientError) {
      return NextResponse.json(
        { error: "Failed to fetch ingredients" },
        { status: 500 }
      )
    }

    // Fetch steps
    const { data: steps, error: stepsError } = await supabase
      .from("recipe_steps")
      .select("*")
      .eq("recipe_id", recipeId)
      .eq("user_id", user.id)
      .order("step_number", { ascending: true })

    if (stepsError) {
      return NextResponse.json(
        { error: "Failed to fetch steps" },
        { status: 500 }
      )
    }

    // Scale ingredients if requested
    const targetServings = query.servings ?? recipe.servings
    const scaledIngredients = (ingredients ?? []).map((ing) => {
      if (targetServings !== recipe.servings) {
        const { quantity, unit } = scaleQuantity(
          ing.quantity,
          recipe.servings,
          targetServings,
          ing.unit
        )
        return { ...ing, quantity, unit }
      }
      return ing
    })

    // Scale macros if servings changed
    const scaleFactor = targetServings / recipe.servings
    const scaledRecipe = {
      ...recipe,
      servings: targetServings,
      macros_kcal: Math.round(recipe.macros_kcal * scaleFactor),
      macros_protein_g: Math.round(recipe.macros_protein_g * scaleFactor * 100) / 100,
      macros_carbs_g: Math.round(recipe.macros_carbs_g * scaleFactor * 100) / 100,
      macros_fat_g: Math.round(recipe.macros_fat_g * scaleFactor * 100) / 100,
    }

    return NextResponse.json(
      {
        ok: true,
        recipe: scaledRecipe,
        ingredients: scaledIngredients ?? [],
        steps: steps ?? [],
        scaling_factor: scaleFactor,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("GET /api/ai/recipes/:id error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: "Internal error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

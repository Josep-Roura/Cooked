import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const requestSchema = z.object({
  recipe_id: z.string().min(1, "Recipe ID required"),
  new_servings: z.number().int().positive("New servings must be positive"),
})

type RequestPayload = z.infer<typeof requestSchema>

/**
 * Calculate scaled quantity based on servings
 * Handles special cases like whole eggs, cans, etc.
 */
function scaleQuantity(
  quantity: number,
  originalServings: number,
  newServings: number,
  unit: string
): { quantity: number; unit: string } {
  // Scale quantity proportionally
  const scaleFactor = newServings / originalServings
  let scaledQuantity = quantity * scaleFactor

  // Handle special units that shouldn't have decimals
  const wholeUnits = ["egg", "eggs", "can", "cans", "package", "packages", "loaf", "loaves", "bulb", "bulbs", "head", "heads"]
  const isWholeUnit = wholeUnits.some((u) => unit.toLowerCase().includes(u))

  if (isWholeUnit) {
    scaledQuantity = Math.round(scaledQuantity)
    // If result is 0, at least use 1
    if (scaledQuantity === 0) scaledQuantity = 1
  } else {
    // Round to 2 decimal places for other units
    scaledQuantity = Math.round(scaledQuantity * 100) / 100
  }

  return { quantity: scaledQuantity, unit }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      )
    }

    const payload = requestSchema.parse(body)

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
      .eq("id", payload.recipe_id)
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
      .eq("recipe_id", payload.recipe_id)
      .eq("user_id", user.id)

    if (ingredientError) {
      return NextResponse.json(
        { error: "Failed to fetch ingredients" },
        { status: 500 }
      )
    }

    // Scale ingredients
    const scaledIngredients = (ingredients ?? []).map((ing) => ({
      ...ing,
      ...scaleQuantity(ing.quantity, recipe.servings, payload.new_servings, ing.unit),
    }))

    return NextResponse.json(
      {
        ok: true,
        recipe: {
          ...recipe,
          servings: payload.new_servings,
          scaling_factor: payload.new_servings / recipe.servings,
        },
        ingredients: scaledIngredients,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("POST /api/ai/recipes/scale error:", error)

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

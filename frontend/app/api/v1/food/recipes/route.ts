import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(_req: NextRequest) {
  try {
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

    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to load recipes", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ recipes: data ?? [] }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/food/recipes error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

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

    const title = typeof body.title === "string" ? body.title.trim() : ""
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const payload = {
      user_id: user.id,
      title,
      emoji: typeof body.emoji === "string" ? body.emoji.trim() : null,
      description: typeof body.description === "string" ? body.description.trim() : null,
      servings: typeof body.servings === "number" ? body.servings : 1,
      cook_time_min: typeof body.cook_time_min === "number" ? body.cook_time_min : null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      category: typeof body.category === "string" ? body.category : null,
      macros_kcal: typeof body.macros_kcal === "number" ? body.macros_kcal : 0,
      macros_protein_g: typeof body.macros_protein_g === "number" ? body.macros_protein_g : 0,
      macros_carbs_g: typeof body.macros_carbs_g === "number" ? body.macros_carbs_g : 0,
      macros_fat_g: typeof body.macros_fat_g === "number" ? body.macros_fat_g : 0,
    }

    const { data: recipe, error: recipeError } = await supabase.from("recipes").insert(payload).select("*").single()

    if (recipeError) {
      return NextResponse.json({ error: "Failed to create recipe", details: recipeError.message }, { status: 400 })
    }

    const ingredients = Array.isArray(body.ingredients) ? body.ingredients : []
    if (ingredients.length > 0) {
      const ingredientRows = ingredients.map((ingredient: Record<string, unknown>) => ({
        recipe_id: recipe.id,
        user_id: user.id,
        name: String(ingredient.name ?? "").trim(),
        quantity: typeof ingredient.quantity === "number" ? ingredient.quantity : null,
        unit: typeof ingredient.unit === "string" ? ingredient.unit : null,
        category: typeof ingredient.category === "string" ? ingredient.category : "other",
        optional: Boolean(ingredient.optional),
      }))
      await supabase.from("recipe_ingredients").insert(ingredientRows)
    }

    const steps = Array.isArray(body.steps) ? body.steps : []
    if (steps.length > 0) {
      const stepRows = steps.map((step: Record<string, unknown>, index: number) => ({
        recipe_id: recipe.id,
        user_id: user.id,
        step_number: typeof step.step_number === "number" ? step.step_number : index + 1,
        instruction: String(step.instruction ?? "").trim(),
        timer_seconds: typeof step.timer_seconds === "number" ? step.timer_seconds : null,
      }))
      await supabase.from("recipe_steps").insert(stepRows)
    }

    return NextResponse.json({ recipe }, { status: 201 })
  } catch (error) {
    console.error("POST /api/v1/food/recipes error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

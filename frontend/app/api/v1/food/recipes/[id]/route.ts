import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await context.params
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

    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .select("*")
      .eq("id", recipeId)
      .eq("user_id", user.id)
      .single()

    if (recipeError) {
      return NextResponse.json({ error: "Recipe not found", details: recipeError.message }, { status: 404 })
    }

    const { data: ingredients } = await supabase
      .from("recipe_ingredients")
      .select("*")
      .eq("recipe_id", recipeId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })

    const { data: steps } = await supabase
      .from("recipe_steps")
      .select("*")
      .eq("recipe_id", recipeId)
      .eq("user_id", user.id)
      .order("step_number", { ascending: true })

    return NextResponse.json({ recipe, ingredients: ingredients ?? [], steps: steps ?? [] }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/food/recipes/:id error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await context.params
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

    const updatePayload: Record<string, unknown> = {}
    if (typeof body.title === "string") updatePayload.title = body.title.trim()
    if (typeof body.emoji === "string") updatePayload.emoji = body.emoji.trim()
    if (body.emoji === null) updatePayload.emoji = null
    if (typeof body.description === "string") updatePayload.description = body.description.trim()
    if (body.description === null) updatePayload.description = null
    if (typeof body.servings === "number") updatePayload.servings = body.servings
    if (typeof body.cook_time_min === "number") updatePayload.cook_time_min = body.cook_time_min
    if (body.cook_time_min === null) updatePayload.cook_time_min = null
    if (Array.isArray(body.tags)) updatePayload.tags = body.tags
    if (typeof body.category === "string") updatePayload.category = body.category
    if (body.category === null) updatePayload.category = null
    if (typeof body.macros_kcal === "number") updatePayload.macros_kcal = body.macros_kcal
    if (typeof body.macros_protein_g === "number") updatePayload.macros_protein_g = body.macros_protein_g
    if (typeof body.macros_carbs_g === "number") updatePayload.macros_carbs_g = body.macros_carbs_g
    if (typeof body.macros_fat_g === "number") updatePayload.macros_fat_g = body.macros_fat_g

    const { data: recipe, error: updateError } = await supabase
      .from("recipes")
      .update(updatePayload)
      .eq("id", recipeId)
      .eq("user_id", user.id)
      .select("*")
      .single()

    if (updateError) {
      return NextResponse.json({ error: "Failed to update recipe", details: updateError.message }, { status: 400 })
    }

    if (Array.isArray(body.ingredients)) {
      await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId).eq("user_id", user.id)
      const ingredientRows = body.ingredients.map((ingredient: Record<string, unknown>) => ({
        recipe_id: recipeId,
        user_id: user.id,
        name: String(ingredient.name ?? "").trim(),
        quantity: typeof ingredient.quantity === "number" ? ingredient.quantity : null,
        unit: typeof ingredient.unit === "string" ? ingredient.unit : null,
        category: typeof ingredient.category === "string" ? ingredient.category : "other",
        optional: Boolean(ingredient.optional),
      }))
      if (ingredientRows.length > 0) {
        await supabase.from("recipe_ingredients").insert(ingredientRows)
      }
    }

    if (Array.isArray(body.steps)) {
      await supabase.from("recipe_steps").delete().eq("recipe_id", recipeId).eq("user_id", user.id)
      const stepRows = body.steps.map((step: Record<string, unknown>, index: number) => ({
        recipe_id: recipeId,
        user_id: user.id,
        step_number: typeof step.step_number === "number" ? step.step_number : index + 1,
        instruction: String(step.instruction ?? "").trim(),
        timer_seconds: typeof step.timer_seconds === "number" ? step.timer_seconds : null,
      }))
      if (stepRows.length > 0) {
        await supabase.from("recipe_steps").insert(stepRows)
      }
    }

    return NextResponse.json({ recipe }, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/v1/food/recipes/:id error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await context.params
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

    const { error } = await supabase.from("recipes").delete().eq("id", recipeId).eq("user_id", user.id)
    if (error) {
      return NextResponse.json({ error: "Failed to delete recipe", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("DELETE /api/v1/food/recipes/:id error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const OPENAI_URL = "https://api.openai.com/v1/chat/completions"
const OPENAI_TIMEOUT_MS = 60000 // 1 minute
const OPENAI_MODEL = "gpt-4o-mini"

// Validation schemas
const ingredientSchema = z.object({
  name: z.string().min(1, "Ingredient name required"),
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.string().min(1, "Unit required"),
  category: z.string().default("other"),
  optional: z.boolean().default(false),
})

const stepSchema = z.object({
  instruction: z.string().min(1, "Step instruction required"),
  timer_seconds: z.number().nonnegative().optional().nullable(),
})

const recipeGenerationSchema = z.object({
  title: z.string().min(1, "Recipe title required"),
  servings: z.number().int().positive("Servings must be at least 1"),
  ingredients: z.array(ingredientSchema).min(1, "At least one ingredient required"),
  steps: z.array(stepSchema).min(1, "At least one step required"),
  cook_time_min: z.number().nonnegative().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  macros_kcal: z.number().nonnegative().default(0),
  macros_protein_g: z.number().nonnegative().default(0),
  macros_carbs_g: z.number().nonnegative().default(0),
  macros_fat_g: z.number().nonnegative().default(0),
})

const requestPayloadSchema = z.object({
  meal_name: z.string().min(1, "Meal name required"),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  servings: z.number().int().min(1).default(1),
  dietary_preferences: z.array(z.string()).optional(),
  ingredients_to_include: z.array(z.string()).optional(),
  ingredients_to_avoid: z.array(z.string()).optional(),
  cook_time_max_min: z.number().nonnegative().optional(),
  target_macros: z.object({
    kcal: z.number().nonnegative().optional(),
    protein_g: z.number().nonnegative().optional(),
    carbs_g: z.number().nonnegative().optional(),
    fat_g: z.number().nonnegative().optional(),
  }).optional(),
})

type RecipeGeneration = z.infer<typeof recipeGenerationSchema>
type RequestPayload = z.infer<typeof requestPayloadSchema>

function buildRecipePrompt(payload: RequestPayload): string {
  const macroTargets = payload.target_macros
    ? `Target macros: ${macroTargets.kcal ? macroTargets.kcal + " kcal" : ""} ${macroTargets.protein_g ? macroTargets.protein_g + "g protein" : ""} ${macroTargets.carbs_g ? macroTargets.carbs_g + "g carbs" : ""} ${macroTargets.fat_g ? macroTargets.fat_g + "g fat" : ""}`.trim()
    : ""

  return `Generate a detailed recipe for "${payload.meal_name}" (${payload.meal_type}).
Servings: ${payload.servings}
${payload.ingredients_to_include?.length ? `Include these ingredients: ${payload.ingredients_to_include.join(", ")}` : ""}
${payload.ingredients_to_avoid?.length ? `Avoid these ingredients: ${payload.ingredients_to_avoid.join(", ")}` : ""}
${payload.dietary_preferences?.length ? `Dietary preferences: ${payload.dietary_preferences.join(", ")}` : ""}
${payload.cook_time_max_min ? `Maximum cooking time: ${payload.cook_time_max_min} minutes` : ""}
${macroTargets ? macroTargets : ""}

Respond with a JSON object containing:
{
  "title": "Recipe title",
  "description": "Brief description",
  "servings": ${payload.servings},
  "cook_time_min": estimated_minutes,
  "ingredients": [
    {
      "name": "ingredient name",
      "quantity": number_as_base_for_servings,
      "unit": "g/ml/cup/tbsp/etc",
      "category": "protein/vegetable/grain/dairy/oil/spice/other",
      "optional": false
    }
  ],
  "steps": [
    {
      "instruction": "Step description",
      "timer_seconds": seconds_or_null
    }
  ],
  "notes": "Any special notes",
  "macros_kcal": estimated_total_kcal_for_servings,
  "macros_protein_g": estimated_total_protein_g,
  "macros_carbs_g": estimated_total_carbs_g,
  "macros_fat_g": estimated_total_fat_g
}

IMPORTANT:
- quantity values must be the TOTAL amount for ALL servings (will be auto-scaled)
- Use standard, measurable units (g, ml, cup, tbsp, tsp, etc.)
- Ingredients should be adaptable by scaling quantities proportionally
- Include 5-8 cooking steps minimum
- Macros should be estimated total for all servings
- Be specific and practical`
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

    // Validate request payload
    const payload = requestPayloadSchema.parse(body)

    // Get authenticated user
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Build prompt
    const prompt = buildRecipePrompt(payload)

    // Call OpenAI
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

    const openaiResponse = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a professional recipe developer. Generate detailed, practical recipes with accurate macronutrient estimates. Always respond with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}))
      console.error("OpenAI API error:", errorData)
      return NextResponse.json(
        { error: "Failed to generate recipe", details: errorData },
        { status: 500 }
      )
    }

    const openaiData = await openaiResponse.json()
    const content = openaiData.choices?.[0]?.message?.content ?? ""

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse recipe from response" },
        { status: 500 }
      )
    }

    const recipeData = JSON.parse(jsonMatch[0])

    // Validate recipe schema
    const recipe = recipeGenerationSchema.parse(recipeData)

    // Save recipe to database
    const recipePayload = {
      user_id: user.id,
      title: recipe.title,
      description: recipe.description ?? null,
      servings: recipe.servings,
      cook_time_min: recipe.cook_time_min ?? null,
      macros_kcal: recipe.macros_kcal,
      macros_protein_g: recipe.macros_protein_g,
      macros_carbs_g: recipe.macros_carbs_g,
      macros_fat_g: recipe.macros_fat_g,
      tags: payload.dietary_preferences ?? [],
      category: payload.meal_type,
    }

    const { data: savedRecipe, error: recipeError } = await supabase
      .from("recipes")
      .insert(recipePayload)
      .select("*")
      .single()

    if (recipeError || !savedRecipe) {
      console.error("Failed to save recipe:", recipeError)
      return NextResponse.json(
        { error: "Failed to save recipe", details: recipeError?.message },
        { status: 500 }
      )
    }

    // Save ingredients
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      const ingredientRows = recipe.ingredients.map((ing) => ({
        recipe_id: savedRecipe.id,
        user_id: user.id,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        category: ing.category,
        optional: ing.optional ?? false,
      }))

      const { error: ingredientError } = await supabase
        .from("recipe_ingredients")
        .insert(ingredientRows)

      if (ingredientError) {
        console.error("Failed to save ingredients:", ingredientError)
        return NextResponse.json(
          { error: "Failed to save ingredients", details: ingredientError.message },
          { status: 500 }
        )
      }
    }

    // Save steps
    if (recipe.steps && recipe.steps.length > 0) {
      const stepRows = recipe.steps.map((step, index) => ({
        recipe_id: savedRecipe.id,
        user_id: user.id,
        step_number: index + 1,
        instruction: step.instruction,
        timer_seconds: step.timer_seconds ?? null,
      }))

      const { error: stepError } = await supabase
        .from("recipe_steps")
        .insert(stepRows)

      if (stepError) {
        console.error("Failed to save steps:", stepError)
        return NextResponse.json(
          { error: "Failed to save steps", details: stepError.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      {
        ok: true,
        recipe: {
          id: savedRecipe.id,
          ...recipe,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/ai/recipes error:", error)

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

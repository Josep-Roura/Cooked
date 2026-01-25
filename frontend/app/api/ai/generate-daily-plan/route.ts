import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import crypto from "node:crypto"
import { createServerClient } from "@/lib/supabase/server"
import { computeNutritionTargets, buildRationale } from "@/lib/nutrition/targets.js"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const IngredientSchema = z.object({
  name: z.string().min(1),
  amount_g: z.number().nonnegative(),
  unit: z.string().optional().default("g"),
  notes: z.string().optional().nullable(),
})

const MealSchema = z.object({
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  title: z.string().min(1),
  emoji: z.string().optional().default("🍽️"),
  time: z.string().optional().nullable(),
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  ingredients: z.array(IngredientSchema).default([]),
  notes: z.string().optional().nullable(),
})

const PlanSchema = z.object({
  meals: z.array(MealSchema).min(3),
  totals: z.object({
    kcal: z.number().nonnegative(),
    protein_g: z.number().nonnegative(),
    carbs_g: z.number().nonnegative(),
    fat_g: z.number().nonnegative(),
  }),
  rationale: z.string().min(1),
})

function hashPrompt(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const date = typeof body.date === "string" ? body.date : ""
    const force = Boolean(body.force)
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

    const { data: existingPlan } = await supabase
      .from("meal_plans")
      .select("id, locked")
      .eq("user_id", user.id)
      .eq("date", date)
      .single()

    if (existingPlan?.locked && !force) {
      return NextResponse.json({ error: "Plan is locked. Use force=true to overwrite." }, { status: 409 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("weight_kg, primary_goal, diet, meta")
      .eq("id", user.id)
      .single()

    const { data: workouts } = await supabase
      .from("tp_workouts")
      .select("workout_type, planned_hours, actual_hours")
      .eq("user_id", user.id)
      .eq("workout_day", date)

    const targets = computeNutritionTargets({
      weightKg: profile?.weight_kg ?? 70,
      goal: profile?.primary_goal ?? "maintain",
      sessions: workouts ?? [],
    })

    const dislikeList =
      profile?.meta && typeof profile.meta === "object" && Array.isArray(profile.meta.dislikes)
        ? profile.meta.dislikes
        : []

    const prompt = `You are a nutrition assistant. Build a daily meal plan for ${date}.
Targets: ${targets.target_kcal} kcal, protein ${targets.target_protein_g}g, carbs ${targets.target_carbs_g}g, fat ${targets.target_fat_g}g.
Training day type: ${targets.training_day_type}.
Diet preferences: ${profile?.diet ?? "none"}. Dislikes: ${dislikeList.join(", ") || "none"}.
Return JSON strictly matching this schema:
{
  "meals": [
    {
      "meal_type": "breakfast|lunch|dinner|snack",
      "title": "string",
      "emoji": "string",
      "time": "HH:MM",
      "kcal": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "ingredients": [{"name": "string", "amount_g": number, "unit": "g", "notes": "string"}],
      "notes": "string"
    }
  ],
  "totals": {"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number},
  "rationale": "string"
}
Only output JSON.`

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 500 })
    }

    const requestBody = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful nutrition planner." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }

    const startTime = Date.now()
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      return NextResponse.json({ error: "AI request failed", details: errorBody }, { status: 502 })
    }

    const aiResult = await response.json()
    const content = aiResult.choices?.[0]?.message?.content ?? "{}"
    const parsed = PlanSchema.safeParse(JSON.parse(content))

    const latencyMs = Date.now() - startTime
    const promptHash = hashPrompt(prompt)

    await supabase.from("ai_requests").insert({
      user_id: user.id,
      provider: "openai",
      model: "gpt-4o-mini",
      prompt_hash: promptHash,
      response_json: aiResult,
      latency_ms: latencyMs,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid AI response", details: parsed.error.flatten() }, { status: 400 })
    }

    const planData = parsed.data
    const rationale = planData.rationale || buildRationale(targets)

    const { data: planRow, error: planError } = await supabase
      .from("meal_plans")
      .upsert(
        {
          user_id: user.id,
          date,
          target_kcal: targets.target_kcal,
          target_protein_g: targets.target_protein_g,
          target_carbs_g: targets.target_carbs_g,
          target_fat_g: targets.target_fat_g,
          training_day_type: targets.training_day_type,
          status: "generated",
          locked: false,
          rationale,
        },
        { onConflict: "user_id,date" },
      )
      .select("*")
      .single()

    if (planError || !planRow) {
      return NextResponse.json({ error: "Failed to save plan", details: planError?.message ?? null }, { status: 400 })
    }

    await supabase.from("meal_plan_items").delete().eq("meal_plan_id", planRow.id)

    for (const [index, meal] of planData.meals.entries()) {
      const { data: recipeRow, error: recipeError } = await supabase
        .from("recipes")
        .insert({
          user_id: user.id,
          title: meal.title,
          description: meal.notes ?? null,
          servings: 1,
          macros_kcal: meal.kcal,
          macros_protein_g: meal.protein_g,
          macros_carbs_g: meal.carbs_g,
          macros_fat_g: meal.fat_g,
        })
        .select("*")
        .single()

      if (recipeError || !recipeRow) {
        return NextResponse.json({ error: "Failed to save recipe", details: recipeError?.message ?? null }, { status: 400 })
      }

      if (meal.ingredients.length > 0) {
        const ingredientRows = meal.ingredients.map((ingredient) => ({
          recipe_id: recipeRow.id,
          user_id: user.id,
          name: ingredient.name,
          quantity: ingredient.amount_g,
          unit: ingredient.unit ?? "g",
          category: "other",
          optional: Boolean(ingredient.notes),
        }))
        await supabase.from("recipe_ingredients").insert(ingredientRows)
      }

      const slotMap: Record<string, number> = { breakfast: 1, lunch: 2, dinner: 3, snack: 4 }
      const slot = slotMap[meal.meal_type] ?? index + 1

      const { error: itemError } = await supabase.from("meal_plan_items").insert({
        meal_plan_id: planRow.id,
        slot,
        meal_type: meal.meal_type,
        sort_order: index + 1,
        name: meal.title,
        time: meal.time ?? null,
        emoji: meal.emoji ?? null,
        kcal: meal.kcal,
        protein_g: meal.protein_g,
        carbs_g: meal.carbs_g,
        fat_g: meal.fat_g,
        eaten: false,
        notes: meal.notes ?? null,
        recipe_id: recipeRow.id,
      })

      if (itemError) {
        return NextResponse.json({ error: "Failed to save meal items", details: itemError.message }, { status: 400 })
      }
    }

    await supabase.from("nutrition_plan_rows").insert({
      user_id: user.id,
      date,
      day_type: targets.training_day_type,
      kcal: targets.target_kcal,
      protein_g: targets.target_protein_g,
      carbs_g: targets.target_carbs_g,
      fat_g: targets.target_fat_g,
      intra_cho_g_per_h: 0,
    })

    return NextResponse.json({ plan: planRow, meals: planData.meals, targets }, { status: 200 })
  } catch (error) {
    console.error("POST /api/ai/generate-daily-plan error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

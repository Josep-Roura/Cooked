import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const MEAL_TEMPLATES = [
  { name: "Breakfast", emoji: "🍳", time: "07:30", ingredients: ["Oats", "Yogurt"] },
  { name: "Lunch", emoji: "🥗", time: "12:30", ingredients: ["Rice", "Chicken"] },
  { name: "Dinner", emoji: "🍽️", time: "19:00", ingredients: ["Salmon", "Veggies"] },
  { name: "Snack", emoji: "🥨", time: "16:00", ingredients: ["Fruit", "Nuts"] },
]

function buildSlots(mealsPerDay: number) {
  const count = Math.max(1, Math.min(mealsPerDay, MEAL_TEMPLATES.length))
  return MEAL_TEMPLATES.slice(0, count).map((template, index) => ({ slot: index + 1, ...template }))
}

function computeFallbackMacros(weightKg: number, mealsPerDay: number) {
  const kcal = Math.round(weightKg * 30)
  const protein_g = Math.round(weightKg * 1.8)
  const fat_g = Math.max(40, Math.round(weightKg * 0.9))
  const carbs_g = Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4))
  return { kcal, protein_g, carbs_g, fat_g }
}

function splitPerMeal(totals: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }, mealsPerDay: number) {
  return {
    kcal: Math.round(totals.kcal / mealsPerDay),
    protein_g: Math.round(totals.protein_g / mealsPerDay),
    carbs_g: Math.round(totals.carbs_g / mealsPerDay),
    fat_g: Math.round(totals.fat_g / mealsPerDay),
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get("date") ?? ""

    if (!DATE_REGEX.test(date)) {
      return NextResponse.json({ ok: false, error: "Invalid date." }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated", details: authError?.message ?? null },
        { status: 401 },
      )
    }

    const [{ data: existingMeals }, { data: planRows }, { data: profile }] = await Promise.all([
      supabase
        .from("nutrition_meals")
        .select("id, date")
        .eq("user_id", user.id)
        .eq("date", date)
        .limit(1),
      supabase
        .from("nutrition_plan_rows")
        .select("id, kcal, protein_g, carbs_g, fat_g, intra_cho_g_per_h")
        .eq("user_id", user.id)
        .eq("date", date)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase.from("profiles").select("meals_per_day, weight_kg").eq("id", user.id).maybeSingle(),
    ])

    const mealsExist = (existingMeals ?? []).length > 0

    const { data: existingPlan } = await supabase
      .from("meal_plans")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle()

    let planId = existingPlan?.id ?? null
    if (!planId) {
      const { data: createdPlan, error: planError } = await supabase
        .from("meal_plans")
        .upsert({ user_id: user.id, date }, { onConflict: "user_id,date" })
        .select("id")
        .single()
      if (planError || !createdPlan) {
        return NextResponse.json(
          { ok: false, error: "Failed to ensure meal plan", details: planError?.message ?? null },
          { status: 400 },
        )
      }
      planId = createdPlan.id
    }

    const { data: existingItems } = await supabase
      .from("meal_plan_items")
      .select("id")
      .eq("meal_plan_id", planId)

    if (mealsExist && (existingItems ?? []).length > 0) {
      return NextResponse.json({ ok: true, exists: true, created: false }, { status: 200 })
    }

    const mealsPerDay = profile?.meals_per_day ?? 3
    const slots = buildSlots(mealsPerDay)
    const target = planRows?.[0] ?? null
    const fallback = computeFallbackMacros(profile?.weight_kg ?? 70, slots.length)
    const totals = target
      ? {
          kcal: target.kcal ?? fallback.kcal,
          protein_g: target.protein_g ?? fallback.protein_g,
          carbs_g: target.carbs_g ?? fallback.carbs_g,
          fat_g: target.fat_g ?? fallback.fat_g,
        }
      : fallback
    const perMeal = splitPerMeal(totals, slots.length)

    await supabase.from("meal_plan_ingredients").delete().in("meal_item_id", (existingItems ?? []).map((item) => item.id))
    await supabase.from("meal_plan_items").delete().eq("meal_plan_id", planId)

    const itemsPayload = slots.map((slot, index) => ({
      meal_plan_id: planId,
      slot: slot.slot,
      name: slot.name,
      time: slot.time,
      emoji: slot.emoji,
      kcal: index === slots.length - 1 ? totals.kcal - perMeal.kcal * (slots.length - 1) : perMeal.kcal,
      protein_g:
        index === slots.length - 1
          ? totals.protein_g - perMeal.protein_g * (slots.length - 1)
          : perMeal.protein_g,
      carbs_g:
        index === slots.length - 1
          ? totals.carbs_g - perMeal.carbs_g * (slots.length - 1)
          : perMeal.carbs_g,
      fat_g: index === slots.length - 1 ? totals.fat_g - perMeal.fat_g * (slots.length - 1) : perMeal.fat_g,
    }))

    const { data: insertedItems, error: itemsError } = await supabase
      .from("meal_plan_items")
      .insert(itemsPayload)
      .select("id, name")

    if (itemsError) {
      return NextResponse.json({ ok: false, error: "Failed to ensure meal items", details: itemsError.message }, { status: 400 })
    }

    const nutritionMeals = slots.map((slot, index) => ({
      user_id: user.id,
      date,
      slot: slot.slot,
      name: slot.name,
      time: slot.time,
      kcal: itemsPayload[index]?.kcal ?? 0,
      protein_g: itemsPayload[index]?.protein_g ?? 0,
      carbs_g: itemsPayload[index]?.carbs_g ?? 0,
      fat_g: itemsPayload[index]?.fat_g ?? 0,
      ingredients: slot.ingredients.map((name) => ({ name })),
      eaten: false,
    }))

    if (!mealsExist) {
      const { error: mealError } = await supabase
        .from("nutrition_meals")
        .upsert(nutritionMeals, { onConflict: "user_id,date,slot" })
      if (mealError) {
        return NextResponse.json({ ok: false, error: "Failed to ensure nutrition meals", details: mealError.message }, { status: 400 })
      }
    }

    const ingredientPayload = (insertedItems ?? []).flatMap((item) => {
      const template = MEAL_TEMPLATES.find((meal) => meal.name === item.name)
      const ingredients = template?.ingredients ?? []
      return ingredients.map((name) => ({
        meal_item_id: item.id,
        name,
      }))
    })

    if (ingredientPayload.length > 0) {
      await supabase.from("meal_plan_ingredients").insert(ingredientPayload)
    }

    return NextResponse.json({ ok: true, exists: false, created: true }, { status: 200 })
  } catch (error) {
    console.error("POST /api/v1/meals/ensure-day error:", error)
    return NextResponse.json(
      { ok: false, error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

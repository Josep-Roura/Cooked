import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const MEAL_TEMPLATES = [
  { name: "Breakfast", emoji: "🍳", time: "07:30", ingredients: ["Oats", "Yogurt"] },
  { name: "Lunch", emoji: "🥗", time: "12:30", ingredients: ["Rice", "Chicken"] },
  { name: "Dinner", emoji: "🍽️", time: "19:00", ingredients: ["Salmon", "Veggies"] },
  { name: "Snack", emoji: "🥨", time: "16:00", ingredients: ["Fruit", "Nuts"] },
  { name: "Pre-workout", emoji: "⚡", time: "06:30", ingredients: ["Banana"] },
]

function buildSlots(mealsPerDay: number) {
  const count = Math.max(1, Math.min(mealsPerDay, MEAL_TEMPLATES.length))
  return MEAL_TEMPLATES.slice(0, count).map((template, index) => ({ slot: index + 1, ...template }))
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const start = searchParams.get("start") ?? ""
    const end = searchParams.get("end") ?? ""

    if (!DATE_REGEX.test(start) || !DATE_REGEX.test(end)) {
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

    const { data: profile } = await supabase.from("profiles").select("meals_per_day").eq("id", user.id).single()
    const mealsPerDay = profile?.meals_per_day ?? 3

    const { data: planRows, error: planError } = await supabase
      .from("nutrition_plan_rows")
      .select("id, date, kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)

    if (planError) {
      return NextResponse.json({ error: "Failed to load nutrition plan", details: planError.message }, { status: 400 })
    }

    const { data: existingPlans } = await supabase
      .from("meal_plans")
      .select("id, date")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)

    const existingDates = new Set((existingPlans ?? []).map((plan) => plan.date))
    const rowsByDate = new Map((planRows ?? []).map((row) => [row.date, row]))
    const newPlans = Array.from(rowsByDate.entries())
      .filter(([date]) => !existingDates.has(date))
      .map(([date, row]) => ({
        user_id: user.id,
        date,
        plan_row_id: row.id,
      }))

    if (newPlans.length === 0) {
      return NextResponse.json({ created: 0 }, { status: 200 })
    }

    const { data: insertedPlans, error: insertError } = await supabase
      .from("meal_plans")
      .insert(newPlans)
      .select("*")

    if (insertError) {
      return NextResponse.json({ error: "Failed to create meal plans", details: insertError.message }, { status: 400 })
    }

    const itemsPayload = (insertedPlans ?? []).flatMap((plan) => {
      const row = rowsByDate.get(plan.date)
      if (!row) return []
      const slots = buildSlots(mealsPerDay)
      const perMeal = {
        kcal: Math.round(row.kcal / slots.length),
        protein_g: Math.round(row.protein_g / slots.length),
        carbs_g: Math.round(row.carbs_g / slots.length),
        fat_g: Math.round(row.fat_g / slots.length),
      }
      return slots.map((slot, index) => ({
        meal_plan_id: plan.id,
        slot: slot.slot,
        name: slot.name,
        time: slot.time,
        emoji: slot.emoji,
        kcal: index === slots.length - 1 ? row.kcal - perMeal.kcal * (slots.length - 1) : perMeal.kcal,
        protein_g: index === slots.length - 1 ? row.protein_g - perMeal.protein_g * (slots.length - 1) : perMeal.protein_g,
        carbs_g: index === slots.length - 1 ? row.carbs_g - perMeal.carbs_g * (slots.length - 1) : perMeal.carbs_g,
        fat_g: index === slots.length - 1 ? row.fat_g - perMeal.fat_g * (slots.length - 1) : perMeal.fat_g,
      }))
    })

    const { data: insertedItems, error: itemsError } = await supabase
      .from("meal_plan_items")
      .insert(itemsPayload)
      .select("id, name")

    if (itemsError) {
      return NextResponse.json({ error: "Failed to create meal items", details: itemsError.message }, { status: 400 })
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

    return NextResponse.json({ created: insertedPlans?.length ?? 0 }, { status: 200 })
  } catch (error) {
    console.error("POST /api/v1/meals/ensure error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

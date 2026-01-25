import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import type { Meal } from "@/lib/db/types"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

type NutritionMetaEntry = {
  meals?: Meal[]
  macros?: Record<string, unknown>
  day_type?: string
  meals_per_day?: number
}

function buildIngredientPlaceholders(name: string) {
  const trimmed = name.trim()
  if (!trimmed) {
    return ["Main ingredient", "Seasoning", "Side item"]
  }
  const words = trimmed.split(" ").filter(Boolean)
  const main = words.slice(0, 2).join(" ")
  return [main, "Seasoning", "Side item"]
}

function normalizeMeals(meals: Meal[]) {
  let didUpdate = false
  const normalized = meals.map((meal, index) => {
    const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : buildIngredientPlaceholders(meal.name)
    if (!Array.isArray(meal.ingredients)) {
      didUpdate = true
    }
    const completed = typeof meal.completed === "boolean" ? meal.completed : false
    if (typeof meal.completed !== "boolean") {
      didUpdate = true
    }
    const slot = typeof meal.slot === "number" ? meal.slot : index + 1
    if (slot !== meal.slot) {
      didUpdate = true
    }
    return {
      ...meal,
      slot,
      ingredients,
      completed,
    }
  })
  return { meals: normalized, didUpdate }
}

function parseNutritionMeta(meta: Record<string, unknown> | null | undefined, date: string): NutritionMetaEntry | null {
  if (!meta || typeof meta !== "object") return null
  const raw = (meta as Record<string, unknown>)["nutrition_by_date"]
  if (!raw || typeof raw !== "object") return null
  const entry = (raw as Record<string, NutritionMetaEntry>)[date]
  return entry ?? null
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const date = typeof body.date === "string" ? body.date : ""
    const slot = typeof body.slot === "number" ? body.slot : Number.NaN
    const completed = typeof body.completed === "boolean" ? body.completed : null

    if (!DATE_REGEX.test(date)) {
      return NextResponse.json({ error: "Invalid or missing date (YYYY-MM-DD required)." }, { status: 400 })
    }
    if (!Number.isFinite(slot) || slot <= 0) {
      return NextResponse.json({ error: "Invalid meal slot." }, { status: 400 })
    }
    if (completed === null) {
      return NextResponse.json({ error: "Invalid completed value." }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated", details: authError?.message ?? null }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("meta")
      .eq("id", user.id)
      .single()

    if (profileError) {
      return NextResponse.json(
        { error: "Profile lookup failed", details: profileError.message, code: profileError.code },
        { status: 400 },
      )
    }

    const meta = (profile.meta && typeof profile.meta === "object" ? profile.meta : {}) as Record<string, unknown>
    const metaEntry = parseNutritionMeta(meta, date)
    if (!metaEntry || !Array.isArray(metaEntry.meals) || metaEntry.meals.length === 0) {
      return NextResponse.json({ error: "No meal plan for this day." }, { status: 404 })
    }

    const { meals: normalizedMeals } = normalizeMeals(metaEntry.meals)
    let targetIndex = normalizedMeals.findIndex((meal) => meal.slot === slot)
    if (targetIndex === -1 && slot <= normalizedMeals.length) {
      targetIndex = slot - 1
    }

    if (targetIndex === -1) {
      return NextResponse.json({ error: "Meal slot not found." }, { status: 404 })
    }

    const updatedMeals = normalizedMeals.map((meal, index) =>
      index === targetIndex
        ? {
            ...meal,
            completed,
          }
        : meal,
    )

    const nutritionByDate =
      meta && typeof meta.nutrition_by_date === "object" && meta.nutrition_by_date
        ? (meta.nutrition_by_date as Record<string, NutritionMetaEntry>)
        : {}

    const updatedMeta = {
      ...meta,
      nutrition_by_date: {
        ...nutritionByDate,
        [date]: {
          ...metaEntry,
          meals: updatedMeals,
        },
      },
    }

    const nowIso = new Date().toISOString()
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ meta: updatedMeta, updated_at: nowIso })
      .eq("id", user.id)

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update meal", details: updateError.message, code: updateError.code },
        { status: 400 },
      )
    }

    return NextResponse.json({ ok: true, date, meals: updatedMeals }, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/v1/nutrition/meal error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

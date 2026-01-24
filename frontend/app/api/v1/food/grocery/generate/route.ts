import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

type IngredientInput =
  | string
  | {
      name?: string
      quantity?: number
      unit?: string
      category?: string
    }

function normalizeIngredient(raw: IngredientInput) {
  if (typeof raw === "string") {
    const name = raw.trim()
    return name ? { name } : null
  }
  if (!raw || typeof raw !== "object") {
    return null
  }
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  if (!name) {
    return null
  }
  return {
    name,
    quantity: typeof raw.quantity === "number" ? raw.quantity : null,
    unit: typeof raw.unit === "string" ? raw.unit : null,
    category: typeof raw.category === "string" ? raw.category : "other",
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const start = typeof body.start === "string" ? body.start : ""
    const end = typeof body.end === "string" ? body.end : ""
    if (!DATE_REGEX.test(start) || !DATE_REGEX.test(end)) {
      return NextResponse.json({ error: "Invalid date range." }, { status: 400 })
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

    const { data: schedule, error: scheduleError } = await supabase
      .from("meal_schedule")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)

    if (scheduleError) {
      return NextResponse.json({ error: "Failed to load schedule", details: scheduleError.message }, { status: 400 })
    }

    await supabase
      .from("grocery_items")
      .delete()
      .eq("user_id", user.id)
      .eq("source", "schedule")
      .gte("date_range_start", start)
      .lte("date_range_end", end)

    const items = (schedule ?? []).flatMap((meal) => {
      const ingredients = Array.isArray(meal.ingredients) ? (meal.ingredients as IngredientInput[]) : []
      return ingredients
        .map((ingredient) => normalizeIngredient(ingredient))
        .filter(Boolean)
        .map((ingredient) => ({
          user_id: user.id,
          name: ingredient?.name ?? "",
          quantity: ingredient?.quantity ?? null,
          unit: ingredient?.unit ?? null,
          category: ingredient?.category ?? "other",
          is_bought: false,
          source: "schedule",
          recipe_id: meal.recipe_id ?? null,
          date_range_start: start,
          date_range_end: end,
        }))
    })

    if (items.length === 0) {
      return NextResponse.json({ items: [] }, { status: 200 })
    }

    const { data: inserted, error: insertError } = await supabase.from("grocery_items").insert(items).select("*")
    if (insertError) {
      return NextResponse.json({ error: "Failed to generate grocery list", details: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ items: inserted ?? [] }, { status: 200 })
  } catch (error) {
    console.error("POST /api/v1/food/grocery/generate error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

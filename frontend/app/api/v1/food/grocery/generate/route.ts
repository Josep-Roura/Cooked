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

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  produce: ["lettuce", "spinach", "kale", "tomato", "onion", "garlic", "pepper", "avocado", "broccoli", "carrot"],
  dairy: ["milk", "yogurt", "cheese", "butter", "cream"],
  "meat/fish": ["chicken", "beef", "pork", "salmon", "tuna", "fish", "turkey"],
  pantry: ["rice", "pasta", "bread", "oats", "beans", "lentils", "oil", "flour", "salt", "spice"],
  frozen: ["frozen"],
}

function inferCategory(name: string) {
  const normalized = name.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category
    }
  }
  return "other"
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
  const category =
    typeof raw.category === "string" && raw.category.trim() ? raw.category.trim().toLowerCase() : inferCategory(name)
  return {
    name,
    quantity: typeof raw.quantity === "number" ? raw.quantity : null,
    unit: typeof raw.unit === "string" ? raw.unit : null,
    category,
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

    const aggregated = new Map<string, { name: string; quantity: number | null; unit: string | null; category: string }>()
    const items = (schedule ?? []).flatMap((meal) => {
      const ingredients = Array.isArray(meal.ingredients) ? (meal.ingredients as IngredientInput[]) : []
      return ingredients
        .map((ingredient) => normalizeIngredient(ingredient))
        .filter(Boolean)
        .map((ingredient) => ({
          name: ingredient?.name ?? "",
          quantity: ingredient?.quantity ?? null,
          unit: ingredient?.unit ?? null,
          category: ingredient?.category ?? "other",
        }))
    })

    if (items.length === 0) {
      return NextResponse.json({ items: [] }, { status: 200 })
    }

    items.forEach((item) => {
      const key = `${item.name.toLowerCase()}|${item.unit ?? ""}|${item.category ?? "other"}`
      const existing = aggregated.get(key)
      if (!existing) {
        aggregated.set(key, { ...item })
        return
      }
      if (typeof existing.quantity === "number" && typeof item.quantity === "number") {
        existing.quantity += item.quantity
      } else if (existing.quantity === null && typeof item.quantity === "number") {
        existing.quantity = item.quantity
      }
    })

    const payload = Array.from(aggregated.values()).map((item) => ({
      user_id: user.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      is_bought: false,
      notes: null,
      source: "schedule",
      recipe_id: null,
      date_range_start: start,
      date_range_end: end,
    }))

    const { data: inserted, error: insertError } = await supabase.from("grocery_items").insert(payload).select("*")
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

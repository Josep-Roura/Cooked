import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get("date") ?? ""
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

    const { data: plan, error: planError } = await supabase
      .from("meal_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .single()

    if (planError) {
      return NextResponse.json({ plan: null, items: [] }, { status: 200 })
    }

    const { data: items, error: itemsError } = await supabase
      .from("meal_plan_items")
      .select("*")
      .eq("meal_plan_id", plan.id)
      .order("slot", { ascending: true })

    if (itemsError) {
      return NextResponse.json({ error: "Failed to load meal items", details: itemsError.message }, { status: 400 })
    }

    const itemIds = (items ?? []).map((item) => item.id)
    const { data: ingredients } = await supabase
      .from("meal_plan_ingredients")
      .select("*")
      .in("meal_item_id", itemIds)

    const ingredientsByItem = (ingredients ?? []).reduce((map, ingredient) => {
      if (!map.has(ingredient.meal_item_id)) {
        map.set(ingredient.meal_item_id, [])
      }
      map.get(ingredient.meal_item_id)?.push(ingredient)
      return map
    }, new Map<string, any[]>())

    const hydratedItems = (items ?? []).map((item) => ({
      ...item,
      ingredients: ingredientsByItem.get(item.id) ?? [],
    }))

    return NextResponse.json({ plan, items: hydratedItems }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/meals/day error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

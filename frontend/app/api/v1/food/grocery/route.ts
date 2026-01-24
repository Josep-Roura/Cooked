import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")

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

    let query = supabase.from("grocery_items").select("*").eq("user_id", user.id)
    if (start && end && DATE_REGEX.test(start) && DATE_REGEX.test(end)) {
      query = query
        .gte("date_range_start", start)
        .lte("date_range_end", end)
    }

    const { data, error } = await query.order("category", { ascending: true }).order("name", { ascending: true })

    if (error) {
      return NextResponse.json({ error: "Failed to load grocery items", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ items: data ?? [] }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/food/grocery error:", error)
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

    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const payload = {
      user_id: user.id,
      name,
      quantity: typeof body.quantity === "number" ? body.quantity : null,
      unit: typeof body.unit === "string" ? body.unit : null,
      category: typeof body.category === "string" ? body.category : "other",
      is_bought: Boolean(body.is_bought),
      source: typeof body.source === "string" ? body.source : "manual",
      recipe_id: typeof body.recipe_id === "string" ? body.recipe_id : null,
      date_range_start: typeof body.date_range_start === "string" ? body.date_range_start : null,
      date_range_end: typeof body.date_range_end === "string" ? body.date_range_end : null,
    }

    const { data, error } = await supabase.from("grocery_items").insert(payload).select("*").single()
    if (error) {
      return NextResponse.json({ error: "Failed to create grocery item", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ item: data }, { status: 201 })
  } catch (error) {
    console.error("POST /api/v1/food/grocery error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

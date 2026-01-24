import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")

    if (!start || !end || !DATE_REGEX.test(start) || !DATE_REGEX.test(end)) {
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

    const { data, error } = await supabase
      .from("meal_schedule")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .order("slot", { ascending: true })

    if (error) {
      return NextResponse.json({ error: "Failed to load schedule", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ schedule: data ?? [] }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/food/schedule error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  return PATCH(req)
}

export async function PATCH(req: NextRequest) {
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

    const date = typeof body.date === "string" ? body.date : ""
    const slot = typeof body.slot === "number" ? body.slot : Number.NaN
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!DATE_REGEX.test(date) || !Number.isFinite(slot) || slot <= 0 || !name) {
      return NextResponse.json({ error: "Invalid schedule payload." }, { status: 400 })
    }

    const payload = {
      user_id: user.id,
      date,
      slot,
      name,
      recipe_id: typeof body.recipe_id === "string" ? body.recipe_id : null,
      kcal: typeof body.kcal === "number" ? body.kcal : 0,
      protein_g: typeof body.protein_g === "number" ? body.protein_g : 0,
      carbs_g: typeof body.carbs_g === "number" ? body.carbs_g : 0,
      fat_g: typeof body.fat_g === "number" ? body.fat_g : 0,
      ingredients: body.ingredients ?? null,
    }

    const { data, error } = await supabase
      .from("meal_schedule")
      .upsert(payload, { onConflict: "user_id,date,slot" })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to save schedule", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ schedule: data }, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/v1/food/schedule error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

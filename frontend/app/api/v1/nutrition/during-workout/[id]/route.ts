import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get workout nutrition record
    const { data: nutrition, error: nutritionError } = await supabase
      .from("workout_nutrition")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (nutritionError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Get nutrition items
    const { data: items } = await supabase
      .from("workout_nutrition_items")
      .select("*")
      .eq("workout_nutrition_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })

    return NextResponse.json(
      { ok: true, nutrition, items: items ?? [] },
      { status: 200 }
    )
  } catch (error) {
    console.error("GET /api/v1/nutrition/during-workout/:id error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {}
    if (typeof body.during_workout_recommendation === "string") {
      updatePayload.during_workout_recommendation = body.during_workout_recommendation
    }
    if (typeof body.pre_workout_recommendation === "string") {
      updatePayload.pre_workout_recommendation = body.pre_workout_recommendation
    }
    if (typeof body.post_workout_recommendation === "string") {
      updatePayload.post_workout_recommendation = body.post_workout_recommendation
    }
    if (typeof body.notes === "string") {
      updatePayload.notes = body.notes
    }
    if (typeof body.locked === "boolean") {
      updatePayload.locked = body.locked
    }

    const { data: nutrition, error: updateError } = await supabase
      .from("workout_nutrition")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { ok: true, nutrition },
      { status: 200 }
    )
  } catch (error) {
    console.error("PATCH /api/v1/nutrition/during-workout/:id error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error } = await supabase
      .from("workout_nutrition")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete" },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("DELETE /api/v1/nutrition/during-workout/:id error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

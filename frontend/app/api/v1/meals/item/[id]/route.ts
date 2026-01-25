import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
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

    const updates: Record<string, unknown> = {}
    if (typeof body.eaten === "boolean") updates.eaten = body.eaten
    if (typeof body.name === "string") updates.name = body.name.trim()
    if (typeof body.time === "string") updates.time = body.time
    if (body.time === null) updates.time = null
    if (typeof body.notes === "string") updates.notes = body.notes.trim()
    if (body.notes === null) updates.notes = null

    const { data, error } = await supabase
      .from("meal_plan_items")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update meal item", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ item: data }, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/v1/meals/item/:id error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

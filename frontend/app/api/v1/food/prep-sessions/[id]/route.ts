import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(_req: NextRequest, context: { params: { id: string } }) {
  try {
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

    const { data: session, error } = await supabase
      .from("meal_prep_sessions")
      .select("*")
      .eq("id", context.params.id)
      .eq("user_id", user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: "Meal prep session not found", details: error.message }, { status: 404 })
    }

    const { data: items } = await supabase
      .from("meal_prep_items")
      .select("*")
      .eq("session_id", session.id)
      .eq("user_id", user.id)

    return NextResponse.json({ session: { ...session, items: items ?? [] } }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/food/prep-sessions/:id error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
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

    const updates: Record<string, unknown> = {}
    if (typeof body.title === "string") updates.title = body.title.trim()
    if (typeof body.session_date === "string") updates.session_date = body.session_date
    if (body.session_date === null) updates.session_date = null
    if (typeof body.duration_min === "number") updates.duration_min = body.duration_min
    if (body.duration_min === null) updates.duration_min = null
    if (typeof body.notes === "string") updates.notes = body.notes.trim()
    if (body.notes === null) updates.notes = null

    const { data: session, error } = await supabase
      .from("meal_prep_sessions")
      .update(updates)
      .eq("id", context.params.id)
      .eq("user_id", user.id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update meal prep session", details: error.message }, { status: 400 })
    }

    if (Array.isArray(body.items)) {
      await supabase.from("meal_prep_items").delete().eq("session_id", session.id).eq("user_id", user.id)
      const itemRows = body.items.map((item: Record<string, unknown>) => ({
        session_id: session.id,
        user_id: user.id,
        label: typeof item.label === "string" ? item.label.trim() : "",
        linked_recipe_id: typeof item.linked_recipe_id === "string" ? item.linked_recipe_id : null,
        linked_dates: Array.isArray(item.linked_dates) ? item.linked_dates : null,
        is_done: Boolean(item.is_done),
      }))
      if (itemRows.length > 0) {
        await supabase.from("meal_prep_items").insert(itemRows)
      }
    }

    return NextResponse.json({ session }, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/v1/food/prep-sessions/:id error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: NextRequest, context: { params: { id: string } }) {
  try {
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

    const { error } = await supabase
      .from("meal_prep_sessions")
      .delete()
      .eq("id", context.params.id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: "Failed to delete meal prep session", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("DELETE /api/v1/food/prep-sessions/:id error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

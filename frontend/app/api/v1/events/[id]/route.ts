import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const TIME_REGEX = /^\d{2}:\d{2}$/

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
    if (typeof body.title === "string") updates.title = body.title.trim()
    if (typeof body.date === "string") updates.date = body.date
    if (typeof body.time === "string") {
      if (!TIME_REGEX.test(body.time)) {
        return NextResponse.json({ error: "Time must be HH:MM." }, { status: 400 })
      }
      updates.time = body.time
    }
    if (body.time === null) updates.time = null
    if (typeof body.category === "string") updates.category = body.category
    if (body.category === null) updates.category = null
    if (typeof body.notes === "string") updates.notes = body.notes.trim()
    if (body.notes === null) updates.notes = null

    const { data, error } = await supabase
      .from("user_events")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update event", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ event: data }, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/v1/events/:id error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
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
      .from("user_events")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: "Failed to delete event", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("DELETE /api/v1/events/:id error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

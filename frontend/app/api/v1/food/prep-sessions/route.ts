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

    let query = supabase.from("meal_prep_sessions").select("*").eq("user_id", user.id)
    if (start && end && DATE_REGEX.test(start) && DATE_REGEX.test(end)) {
      query = query.gte("session_date", start).lte("session_date", end)
    }

    const { data: sessions, error } = await query.order("session_date", { ascending: false })
    if (error) {
      return NextResponse.json({ error: "Failed to load meal prep sessions", details: error.message }, { status: 400 })
    }

    const sessionIds = (sessions ?? []).map((session) => session.id)
    let itemsBySession = new Map<string, any[]>()
    if (sessionIds.length > 0) {
      const { data: items } = await supabase
        .from("meal_prep_items")
        .select("*")
        .eq("user_id", user.id)
        .in("session_id", sessionIds)

      itemsBySession = (items ?? []).reduce((map, item) => {
        if (!map.has(item.session_id)) {
          map.set(item.session_id, [])
        }
        map.get(item.session_id)?.push(item)
        return map
      }, new Map<string, any[]>())
    }

    const hydrated = (sessions ?? []).map((session) => ({
      ...session,
      items: itemsBySession.get(session.id) ?? [],
    }))

    return NextResponse.json({ sessions: hydrated }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/food/prep-sessions error:", error)
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

    const title = typeof body.title === "string" ? body.title.trim() : ""
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const payload = {
      user_id: user.id,
      title,
      session_date: typeof body.session_date === "string" ? body.session_date : null,
      duration_min: typeof body.duration_min === "number" ? body.duration_min : null,
      notes: typeof body.notes === "string" ? body.notes.trim() : null,
    }

    const { data: session, error } = await supabase.from("meal_prep_sessions").insert(payload).select("*").single()
    if (error) {
      return NextResponse.json({ error: "Failed to create meal prep session", details: error.message }, { status: 400 })
    }

    const items = Array.isArray(body.items) ? body.items : []
    if (items.length > 0) {
      const itemRows = items.map((item: Record<string, unknown>) => ({
        session_id: session.id,
        user_id: user.id,
        label: typeof item.label === "string" ? item.label.trim() : "",
        linked_recipe_id: typeof item.linked_recipe_id === "string" ? item.linked_recipe_id : null,
        linked_dates: Array.isArray(item.linked_dates) ? item.linked_dates : null,
        is_done: Boolean(item.is_done),
      }))
      await supabase.from("meal_prep_items").insert(itemRows)
    }

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    console.error("POST /api/v1/food/prep-sessions error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

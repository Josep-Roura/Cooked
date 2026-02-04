import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_REGEX = /^\d{2}:\d{2}$/

function parseDate(value: string | null) {
  return value && DATE_REGEX.test(value) ? value : null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const fromParam = parseDate(searchParams.get("from"))
    const toParam = parseDate(searchParams.get("to"))
    const today = new Date()
    const defaultFrom = today.toISOString().slice(0, 10)
    const defaultTo = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()).toISOString().slice(0, 10)

    const from = fromParam ?? defaultFrom
    const to = toParam ?? defaultTo

    console.log("[Events API] GET request:", { from, to, fromParam, toParam })

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[Events API] Auth error:", authError)
      return NextResponse.json(
        { error: "Not authenticated", details: authError?.message ?? null },
        { status: 401 },
      )
    }

    console.log("[Events API] Fetching events for user:", user.id)

    const { data, error } = await supabase
      .from("user_events")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true })
      .order("time", { ascending: true })

    if (error) {
      console.error("[Events API] Query error:", error)
      return NextResponse.json({ error: "Failed to load events", details: error.message }, { status: 400 })
    }

    console.log("[Events API] Success:", { count: data?.length ?? 0 })
    return NextResponse.json({ events: data ?? [] }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/events error:", error)
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
    const date = typeof body.date === "string" ? body.date : ""
    const time = typeof body.time === "string" ? body.time : null
    const category = typeof body.category === "string" ? body.category : null
    const notes = typeof body.notes === "string" ? body.notes.trim() : null

    if (!title || !DATE_REGEX.test(date)) {
      return NextResponse.json({ error: "Title and date are required." }, { status: 400 })
    }

    if (time && !TIME_REGEX.test(time)) {
      return NextResponse.json({ error: "Time must be HH:MM." }, { status: 400 })
    }

    const payload = {
      user_id: user.id,
      title,
      date,
      time,
      category,
      notes,
    }

    const { data, error } = await supabase.from("user_events").insert(payload).select("*").single()
    if (error) {
      return NextResponse.json({ error: "Failed to create event", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ event: data }, { status: 201 })
  } catch (error) {
    console.error("POST /api/v1/events error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

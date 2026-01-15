import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createServerClient } from "@/lib/supabase/server"
import type { EventCategory, ProfileEvent } from "@/lib/db/types"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_REGEX = /^\d{2}:\d{2}$/

function isCategory(value: string): value is EventCategory {
  return value === "race" || value === "test" || value === "other"
}

function normalizeEventInput(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const category = typeof body.category === "string" && isCategory(body.category) ? body.category : "other"
  const goal = typeof body.goal === "string" ? body.goal.trim() : null
  const date = typeof body.date === "string" ? body.date : ""
  const time = typeof body.time === "string" ? body.time : null
  const notes = typeof body.notes === "string" ? body.notes.trim() : null

  return { title, category, goal, date, time, notes }
}

function validateEventInput(input: ReturnType<typeof normalizeEventInput>) {
  if (input.title.length < 2) {
    return "Title must be at least 2 characters."
  }
  if (!DATE_REGEX.test(input.date)) {
    return "Date is required and must be YYYY-MM-DD."
  }
  if (input.time && !TIME_REGEX.test(input.time)) {
    return "Time must be HH:MM."
  }
  return null
}

export async function GET(_req: NextRequest) {
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, meta")
      .eq("id", user.id)
      .single()

    if (profileError) {
      return NextResponse.json(
        { error: "Profile lookup failed", details: profileError.message, code: profileError.code },
        { status: 400 },
      )
    }

    const meta = (profile.meta && typeof profile.meta === "object" ? profile.meta : {}) as Record<string, unknown>
    const events = Array.isArray(meta.events) ? (meta.events as ProfileEvent[]) : []

    return NextResponse.json({ events }, { status: 200 })
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

    const input = normalizeEventInput(body as Record<string, unknown>)
    const validationError = validateEventInput(input)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, meta")
      .eq("id", user.id)
      .single()

    if (profileError) {
      return NextResponse.json(
        { error: "Profile lookup failed", details: profileError.message, code: profileError.code },
        { status: 400 },
      )
    }

    const nowIso = new Date().toISOString()
    const event: ProfileEvent = {
      id: randomUUID(),
      title: input.title,
      category: input.category,
      goal: input.goal || null,
      date: input.date,
      time: input.time || null,
      notes: input.notes || null,
      created_at: nowIso,
      updated_at: nowIso,
    }

    const existingMeta = (profile.meta && typeof profile.meta === "object" ? profile.meta : {}) as Record<string, unknown>
    const existingEvents = Array.isArray(existingMeta.events) ? (existingMeta.events as ProfileEvent[]) : []

    const updatedMeta = {
      ...existingMeta,
      events: [...existingEvents, event],
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ meta: updatedMeta, updated_at: nowIso })
      .eq("id", user.id)

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save event", details: updateError.message, code: updateError.code },
        { status: 400 },
      )
    }

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error("POST /api/v1/events error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

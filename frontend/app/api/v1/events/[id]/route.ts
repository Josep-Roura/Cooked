import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import type { EventCategory, ProfileEvent } from "@/lib/db/types"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_REGEX = /^\d{2}:\d{2}$/

function isCategory(value: string): value is EventCategory {
  return value === "race" || value === "test" || value === "other"
}

function normalizeEventPatch(body: Record<string, unknown>) {
  const update: Partial<ProfileEvent> = {}
  if (typeof body.title === "string") {
    update.title = body.title.trim()
  }
  if (typeof body.category === "string" && isCategory(body.category)) {
    update.category = body.category
  }
  if (typeof body.goal === "string") {
    update.goal = body.goal.trim()
  }
  if (body.goal === null) {
    update.goal = null
  }
  if (typeof body.date === "string") {
    update.date = body.date
  }
  if (typeof body.time === "string") {
    update.time = body.time
  }
  if (body.time === null) {
    update.time = null
  }
  if (typeof body.notes === "string") {
    update.notes = body.notes.trim()
  }
  if (body.notes === null) {
    update.notes = null
  }
  return update
}

function validatePatch(update: Partial<ProfileEvent>) {
  if (update.title !== undefined && update.title.trim().length < 2) {
    return "Title must be at least 2 characters."
  }
  if (update.date !== undefined && !DATE_REGEX.test(update.date)) {
    return "Date must be YYYY-MM-DD."
  }
  if (update.time !== undefined && update.time !== null && !TIME_REGEX.test(update.time)) {
    return "Time must be HH:MM."
  }
  return null
}

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const eventId = context.params.id
    if (!eventId) {
      return NextResponse.json({ error: "Missing event id." }, { status: 400 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const update = normalizeEventPatch(body as Record<string, unknown>)
    const validationError = validatePatch(update)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
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

    const existingMeta = (profile.meta && typeof profile.meta === "object" ? profile.meta : {}) as Record<string, unknown>
    const existingEvents = Array.isArray(existingMeta.events) ? (existingMeta.events as ProfileEvent[]) : []
    const nowIso = new Date().toISOString()

    const updatedEvents = existingEvents.map((event) => {
      if (event.id !== eventId) return event
      return {
        ...event,
        ...update,
        updated_at: nowIso,
      }
    })

    const updatedEvent = updatedEvents.find((event) => event.id === eventId)
    if (!updatedEvent) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 })
    }

    const updatedMeta = {
      ...existingMeta,
      events: updatedEvents,
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ meta: updatedMeta, updated_at: nowIso })
      .eq("id", user.id)

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update event", details: updateError.message, code: updateError.code },
        { status: 400 },
      )
    }

    return NextResponse.json(updatedEvent, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/v1/events/:id error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: NextRequest, context: { params: { id: string } }) {
  try {
    const eventId = context.params.id
    if (!eventId) {
      return NextResponse.json({ error: "Missing event id." }, { status: 400 })
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

    const existingMeta = (profile.meta && typeof profile.meta === "object" ? profile.meta : {}) as Record<string, unknown>
    const existingEvents = Array.isArray(existingMeta.events) ? (existingMeta.events as ProfileEvent[]) : []
    const updatedEvents = existingEvents.filter((event) => event.id !== eventId)

    if (updatedEvents.length === existingEvents.length) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 })
    }

    const updatedMeta = {
      ...existingMeta,
      events: updatedEvents,
    }

    const nowIso = new Date().toISOString()
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ meta: updatedMeta, updated_at: nowIso })
      .eq("id", user.id)

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to delete event", details: updateError.message, code: updateError.code },
        { status: 400 },
      )
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

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

async function ensureThread(supabase: Awaited<ReturnType<typeof createServerClient>>, userId: string, weekStart: string) {
  const { data, error } = await supabase
    .from("plan_chat_threads")
    .upsert(
      {
        user_id: userId,
        week_start_date: weekStart,
      },
      { onConflict: "user_id,week_start_date" },
    )
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const weekStart = searchParams.get("week_start") ?? ""

    if (!DATE_REGEX.test(weekStart)) {
      return NextResponse.json({ error: "Invalid week_start." }, { status: 400 })
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

    const thread = await ensureThread(supabase, user.id, weekStart)

    const { data: messages, error: messagesError } = await supabase
      .from("plan_chat_messages")
      .select("*")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true })

    if (messagesError) {
      return NextResponse.json({ error: "Failed to load messages", details: messagesError.message }, { status: 400 })
    }

    return NextResponse.json({ thread, messages: messages ?? [] }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/plans/chat error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const weekStart = typeof body.week_start === "string" ? body.week_start : ""
    const content = typeof body.content === "string" ? body.content.trim() : ""

    if (!DATE_REGEX.test(weekStart) || !content) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
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

    const thread = await ensureThread(supabase, user.id, weekStart)

    const { error: userMessageError } = await supabase.from("plan_chat_messages").insert({
      thread_id: thread.id,
      user_id: user.id,
      role: "user",
      content,
      meta: {},
    })

    if (userMessageError) {
      return NextResponse.json({ error: "Failed to send message", details: userMessageError.message }, { status: 400 })
    }

    const { error: assistantError } = await supabase.from("plan_chat_messages").insert({
      thread_id: thread.id,
      user_id: user.id,
      role: "assistant",
      content: "Got it — I’ll review your request and propose plan changes shortly.",
      meta: { type: "plan_patch", changes: [] },
    })

    if (assistantError) {
      return NextResponse.json({ error: "Failed to create assistant reply", details: assistantError.message }, { status: 400 })
    }

    const { data: messages, error: messagesError } = await supabase
      .from("plan_chat_messages")
      .select("*")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true })

    if (messagesError) {
      return NextResponse.json({ error: "Failed to load messages", details: messagesError.message }, { status: 400 })
    }

    return NextResponse.json({ thread, messages: messages ?? [] }, { status: 200 })
  } catch (error) {
    console.error("POST /api/v1/plans/chat error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const threadId = searchParams.get("thread_id") ?? ""

    if (!threadId) {
      return NextResponse.json({ error: "thread_id is required." }, { status: 400 })
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

    const { error } = await supabase
      .from("plan_chat_messages")
      .delete()
      .eq("thread_id", threadId)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: "Failed to reset chat", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("DELETE /api/v1/plans/chat error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

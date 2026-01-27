import { NextRequest, NextResponse } from "next/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const date = typeof body?.date === "string" ? body.date : ""
    const force = Boolean(body?.force)
    if (!DATE_REGEX.test(date)) {
      return NextResponse.json(
        { ok: false, error: { code: "invalid_payload", message: "Invalid date." } },
        { status: 400 },
      )
    }

    const origin = new URL(req.url).origin
    const response = await fetch(`${origin}/api/ai/plan/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({ start: date, end: date, force }),
    })
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("POST /api/ai/generate-plan error:", error)
    return NextResponse.json(
      { ok: false, error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

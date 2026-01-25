import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function clampDateRange(start: string, end: string) {
  if (!DATE_REGEX.test(start) || !DATE_REGEX.test(end)) {
    return null
  }
  if (start > end) {
    return null
  }
  return { start, end }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const start = url.searchParams.get("start")
    const end = url.searchParams.get("end")

    if (!start || !end) {
      return NextResponse.json({ error: "Missing start or end date." }, { status: 400 })
    }

    const range = clampDateRange(start, end)
    if (!range) {
      return NextResponse.json({ error: "Invalid date range (YYYY-MM-DD required)." }, { status: 400 })
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

    const { data: meals, error } = await supabase
      .from("nutrition_meals")
      .select("id, date, slot, name, time, kcal, protein_g, carbs_g, fat_g, eaten")
      .eq("user_id", user.id)
      .gte("date", range.start)
      .lte("date", range.end)
      .order("date", { ascending: true })
      .order("slot", { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: "Database error", details: error.message, code: error.code },
        { status: 400 },
      )
    }

    return NextResponse.json({ start: range.start, end: range.end, meals: meals ?? [] }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/nutrition/range error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

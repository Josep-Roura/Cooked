import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      console.error("Invalid JSON body:", body)
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    let date = body.date
    const slot = body.slot

    // Handle ISO date format (e.g., 2024-01-15T00:00:00.000Z) by extracting just the date
    if (typeof date === "string" && date.includes("T")) {
      date = date.split("T")[0]
    }

    console.log("Meal delete request:", { date, slot, dateType: typeof date, slotType: typeof slot, dateRaw: body.date })

    if (!DATE_REGEX.test(date)) {
      console.error("Invalid date:", date)
      return NextResponse.json({ error: "Invalid or missing date (YYYY-MM-DD required)." }, { status: 400 })
    }

    if (!Number.isFinite(slot) || slot <= 0) {
      console.error("Invalid slot:", slot)
      return NextResponse.json({ error: "Invalid meal slot (must be a positive number)." }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("Auth error:", authError)
      return NextResponse.json({ error: "Not authenticated", details: authError?.message ?? null }, { status: 401 })
    }

    console.log("Deleting meal:", { date, slot, userId: user.id })

    // Delete the meal using date and slot (composite key), matching the PATCH endpoint pattern
    const { error: deleteError } = await supabase
      .from("nutrition_meals")
      .delete()
      .eq("user_id", user.id)
      .eq("date", date)
      .eq("slot", slot)

    if (deleteError) {
      console.error("Delete error:", deleteError)
      return NextResponse.json({ error: "Failed to delete meal", details: deleteError.message }, { status: 400 })
    }

    console.info("Meal deleted successfully", { date, slot })
    return NextResponse.json({ ok: true, date, slot }, { status: 200 })
  } catch (error) {
    console.error("POST /api/v1/nutrition/meal/delete error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

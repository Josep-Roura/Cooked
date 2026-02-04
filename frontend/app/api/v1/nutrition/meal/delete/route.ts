import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const mealId = body.mealId
    let date = body.date

    // Handle ISO date format (e.g., 2024-01-15T00:00:00.000Z) by extracting just the date
    if (typeof date === "string" && date.includes("T")) {
      date = date.split("T")[0]
    }

    console.log("Meal delete request:", { mealId, date, dateType: typeof date, dateRaw: body.date })

    if (!mealId) {
      console.error("Missing mealId:", body)
      return NextResponse.json({ error: "Missing mealId" }, { status: 400 })
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error("Invalid date:", date)
      return NextResponse.json({ error: "Invalid or missing date (YYYY-MM-DD required)." }, { status: 400 })
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

    console.log("Deleting meal:", { mealId, date, userId: user.id })

    // Delete the meal
    const { error: deleteError } = await supabase
      .from("nutrition_meals")
      .delete()
      .eq("id", mealId)
      .eq("user_id", user.id)

    if (deleteError) {
      console.error("Delete error:", deleteError)
      return NextResponse.json({ error: "Failed to delete meal", details: deleteError.message }, { status: 400 })
    }

    console.info("Meal deleted successfully", { mealId, date })
    return NextResponse.json({ ok: true, mealId, date }, { status: 200 })
  } catch (error) {
    console.error("POST /api/v1/nutrition/meal/delete error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

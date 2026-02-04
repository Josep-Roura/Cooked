import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const mealId = typeof body.mealId === "string" ? body.mealId : ""
    const date = typeof body.date === "string" ? body.date : ""

    if (!mealId) {
      return NextResponse.json({ error: "Missing mealId" }, { status: 400 })
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid or missing date (YYYY-MM-DD required)." }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated", details: authError?.message ?? null }, { status: 401 })
    }

    // Delete the meal
    const { error: deleteError } = await supabase
      .from("nutrition_meals")
      .delete()
      .eq("id", mealId)
      .eq("user_id", user.id)
      .eq("date", date)

    if (deleteError) {
      return NextResponse.json({ error: "Failed to delete meal", details: deleteError.message }, { status: 400 })
    }

    console.info("DELETE /api/v1/nutrition/meal/delete", {
      userId: user.id,
      mealId,
      date,
    })

    return NextResponse.json({ ok: true, mealId, date }, { status: 200 })
  } catch (error) {
    console.error("DELETE /api/v1/nutrition/meal/delete error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

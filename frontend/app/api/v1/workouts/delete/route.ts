import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const workoutId = typeof body.workoutId === "number" ? body.workoutId : Number(body.workoutId)
    const date = typeof body.date === "string" ? body.date : ""

    if (!Number.isFinite(workoutId) || workoutId <= 0) {
      return NextResponse.json({ error: "Invalid workoutId" }, { status: 400 })
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

    // Delete the workout and any associated nutrition records
    const { error: deleteWorkoutError } = await supabase
      .from("tp_workouts")
      .delete()
      .eq("id", workoutId)
      .eq("user_id", user.id)

    if (deleteWorkoutError) {
      return NextResponse.json(
        { error: "Failed to delete workout", details: deleteWorkoutError.message },
        { status: 400 },
      )
    }

    // Also delete any associated nutrition records for this workout
    await supabase
      .from("nutrition_during_workouts")
      .delete()
      .eq("workout_id", workoutId)
      .eq("user_id", user.id)

    console.info("DELETE /api/v1/workouts/delete", {
      userId: user.id,
      workoutId,
      date,
    })

    return NextResponse.json({ ok: true, workoutId, date }, { status: 200 })
  } catch (error) {
    console.error("DELETE /api/v1/workouts/delete error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      console.error("Invalid JSON body:", body)
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const workoutId = body.workoutId
    let date = body.date

    // Handle ISO date format (e.g., 2024-01-15T00:00:00.000Z) by extracting just the date
    if (typeof date === "string" && date.includes("T")) {
      date = date.split("T")[0]
    }

    console.log("Workout delete request:", { workoutId, date, dateType: typeof date, dateRaw: body.date, workoutIdType: typeof workoutId })

    if (!Number.isFinite(workoutId) || workoutId <= 0) {
      console.error("Invalid workoutId:", workoutId)
      return NextResponse.json({ error: "Invalid workoutId" }, { status: 400 })
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

    console.log("Deleting workout:", { workoutId, date, userId: user.id })

    // Delete the workout
    const { error: deleteWorkoutError } = await supabase
      .from("tp_workouts")
      .delete()
      .eq("id", workoutId)
      .eq("user_id", user.id)

    if (deleteWorkoutError) {
      console.error("Delete workout error:", deleteWorkoutError)
      return NextResponse.json(
        { error: "Failed to delete workout", details: deleteWorkoutError.message },
        { status: 400 },
      )
    }

    // Also delete any associated nutrition records for this workout
    const { error: deleteNutritionError } = await supabase
      .from("nutrition_during_workouts")
      .delete()
      .eq("workout_id", workoutId)
      .eq("user_id", user.id)

    if (deleteNutritionError) {
      console.warn("Failed to delete associated nutrition records:", deleteNutritionError)
    } else {
      console.log("Associated nutrition records deleted")
    }

    console.info("Workout deleted successfully", { workoutId, date })
    return NextResponse.json({ ok: true, workoutId, date }, { status: 200 })
  } catch (error) {
    console.error("POST /api/v1/workouts/delete error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

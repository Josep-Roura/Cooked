import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const body = await req.json().catch(() => null)
    
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { itemId, itemType, newDate, newStartTime } = body
    
    if (!itemId || !itemType || !newDate || !newStartTime) {
      return NextResponse.json(
        { error: "Missing required fields: itemId, itemType, newDate, newStartTime" },
        { status: 400 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated", details: authError?.message ?? null },
        { status: 401 }
      )
    }

    // Calculate end time (meals are 60 min, workouts use their duration)
    const [hours, minutes] = newStartTime.split(":").map(Number)
    const startMinutes = hours * 60 + minutes
    let durationMinutes = 60 // Default for meals
    
    // For workouts, try to preserve original duration
    if (itemType === "workout" || itemType.startsWith("workout-")) {
      const workoutId = itemId.replace("workout-", "")
      const { data: workout } = await supabase
        .from("tp_workouts")
        .select("planned_hours, actual_hours")
        .eq("id", workoutId)
        .single()
      
      if (workout) {
        const hours = workout.actual_hours ?? workout.planned_hours ?? 1
        durationMinutes = Math.round(hours * 60)
      }
    }
    
    const endMinutes = startMinutes + durationMinutes
    const endHours = Math.floor(endMinutes / 60)
    const endMins = endMinutes % 60
    const newEndTime = `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`

    // Update based on item type
    if (itemType === "meal" || itemType.startsWith("nutrition_")) {
      // Update meal_plan_items
      const { error } = await supabase
        .from("meal_plan_items")
        .update({
          date: newDate,
          time: newStartTime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId)
        .eq("user_id", user.id)

      if (error) {
        return NextResponse.json(
          { error: "Failed to update meal", details: error.message },
          { status: 400 }
        )
      }
    } else if (itemType === "workout" || itemType.startsWith("workout-")) {
      // Update tp_workouts
      const workoutId = itemId.replace("workout-", "")
      const { error } = await supabase
        .from("tp_workouts")
        .update({
          workout_day: newDate,
          start_time: newStartTime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workoutId)
        .eq("user_id", user.id)

      if (error) {
        return NextResponse.json(
          { error: "Failed to update workout", details: error.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      itemId,
      newDate,
      newStartTime,
      newEndTime,
    })
  } catch (error) {
    console.error("PATCH /api/v1/plans/schedule error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_REGEX = /^\d{2}:\d{2}$/

export async function POST(req: NextRequest) {
  try {
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      console.error("[POST /api/v1/plans/update-item] JSON parse error:", parseError)
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      )
    }
    
    const { itemId, itemType, newDate, newStartTime } = body

    console.log(`[POST /api/v1/plans/update-item] Request:`, { itemId, itemType, newDate, newStartTime })

    // Validate required fields
    if (!itemId || !itemType || !newDate || !newStartTime) {
      const error = "Missing required fields: itemId, itemType, newDate, newStartTime"
      console.error(`[POST /api/v1/plans/update-item] Validation error:`, { itemId, itemType, newDate, newStartTime })
      return NextResponse.json(
        { error },
        { status: 400 }
      )
    }

    // Validate date and time formats
    if (!DATE_REGEX.test(newDate)) {
      console.error(`[POST /api/v1/plans/update-item] Invalid date format:`, newDate)
      return NextResponse.json({ error: "Invalid date format. Expected: yyyy-MM-dd" }, { status: 400 })
    }

    if (!TIME_REGEX.test(newStartTime)) {
      console.error(`[POST /api/v1/plans/update-item] Invalid time format:`, newStartTime)
      return NextResponse.json({ error: "Invalid time format. Expected: HH:mm" }, { status: 400 })
    }

    // Validate item type
    if (!["meal", "workout"].includes(itemType)) {
      console.error(`[POST /api/v1/plans/update-item] Invalid itemType:`, itemType)
      return NextResponse.json({ error: "Invalid itemType. Must be 'meal' or 'workout'" }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error(`[POST /api/v1/plans/update-item] Auth error:`, authError?.message)
      return NextResponse.json(
        { error: "Not authenticated", details: authError?.message ?? null },
        { status: 401 }
      )
    }

    // Handle meal updates
    if (itemType === "meal") {
      console.log(`[POST /api/v1/plans/update-item] Updating meal ${itemId}`)
      const { data: updatedMeal, error: updateError } = await supabase
        .from("nutrition_meals")
        .update({
          date: newDate,
          time: newStartTime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId)
        .eq("user_id", user.id)
        .eq("locked", false)
        .select("id")

      if (updateError) {
        console.error(`[POST /api/v1/plans/update-item] Meal update error:`, updateError)
        return NextResponse.json(
          { error: "Failed to update meal", details: updateError.message },
          { status: 500 }
        )
      }

      if (!updatedMeal || updatedMeal.length === 0) {
        console.warn(`[POST /api/v1/plans/update-item] Meal not found or locked: ${itemId}`)
        return NextResponse.json(
          { error: "Meal not found or locked" },
          { status: 404 }
        )
      }

      console.log(`[POST /api/v1/plans/update-item] Meal updated successfully:`, updatedMeal)
      return NextResponse.json(
        { success: true, message: "Meal updated successfully" },
        { status: 200 }
      )
    }

    // Handle workout updates
    if (itemType === "workout") {
      console.log(`[POST /api/v1/plans/update-item] Updating workout ${itemId}`)
      // Extract workout ID (format: "workout-{id}" or just the number from sourceId)
      let workoutId = Number(itemId)
      
      // If it's in format "workout-123", extract the number
      if (Number.isNaN(workoutId) && typeof itemId === "string" && itemId.startsWith("workout-")) {
        workoutId = Number(itemId.replace("workout-", ""))
      }

      if (!workoutId || Number.isNaN(workoutId)) {
        console.error(`[POST /api/v1/plans/update-item] Invalid workout ID format:`, itemId)
        return NextResponse.json(
          { error: "Invalid workout ID format" },
          { status: 400 }
        )
      }

      // Update the workout with new date and time
      const { data: updatedWorkout, error: updateError } = await supabase
        .from("tp_workouts")
        .update({
          workout_day: newDate,
          start_time: newStartTime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workoutId)
        .eq("user_id", user.id)
        .select("id")

      if (updateError) {
        console.error(`[POST /api/v1/plans/update-item] Workout update error:`, updateError)
        return NextResponse.json(
          { error: "Failed to update workout", details: updateError.message },
          { status: 500 }
        )
      }

      if (!updatedWorkout || updatedWorkout.length === 0) {
        console.warn(`[POST /api/v1/plans/update-item] Workout not found: ${itemId}`)
        return NextResponse.json(
          { error: "Workout not found or access denied" },
          { status: 404 }
        )
      }

      console.log(`[POST /api/v1/plans/update-item] Workout updated successfully:`, updatedWorkout)
      return NextResponse.json(
        { success: true, message: "Workout updated successfully" },
        { status: 200 }
      )
    }

    return NextResponse.json({ error: "Invalid item type" }, { status: 400 })
  } catch (error) {
    console.error("POST /api/v1/plans/update-item error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

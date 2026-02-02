import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_REGEX = /^\d{2}:\d{2}$/

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { itemId, itemType, newDate, newStartTime } = body

    // Validate required fields
    if (!itemId || !itemType || !newDate || !newStartTime) {
      return NextResponse.json(
        { error: "Missing required fields: itemId, itemType, newDate, newStartTime" },
        { status: 400 }
      )
    }

    // Validate date and time formats
    if (!DATE_REGEX.test(newDate)) {
      return NextResponse.json({ error: "Invalid date format. Expected: yyyy-MM-dd" }, { status: 400 })
    }

    if (!TIME_REGEX.test(newStartTime)) {
      return NextResponse.json({ error: "Invalid time format. Expected: HH:mm" }, { status: 400 })
    }

    // Validate item type
    if (!["meal", "workout"].includes(itemType)) {
      return NextResponse.json({ error: "Invalid itemType. Must be 'meal' or 'workout'" }, { status: 400 })
    }

    const supabase = await createServerClient()
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

    // Handle meal updates
    if (itemType === "meal") {
      // The itemId from the frontend is in format "date:slot" (e.g., "2026-02-04:1")
      // We need to parse it to find the actual meal in the database
      const idParts = itemId.split(":")
      let mealQuery
      
      if (idParts.length === 2 && DATE_REGEX.test(idParts[0]) && !isNaN(Number(idParts[1]))) {
        // ID is in "date:slot" format - search by date, slot, and user_id
        const [originalDate, originalSlot] = idParts
        mealQuery = supabase
          .from("nutrition_meals")
          .select("id, locked, kcal, protein_g, carbs_g, fat_g, slot, date")
          .eq("user_id", user.id)
          .eq("date", originalDate)
          .eq("slot", Number(originalSlot))
          .single()
      } else {
        // ID is a direct UUID - search by id
        mealQuery = supabase
          .from("nutrition_meals")
          .select("id, locked, kcal, protein_g, carbs_g, fat_g, slot, date")
          .eq("id", itemId)
          .eq("user_id", user.id)
          .single()
      }
      
      const { data: existingMeal, error: fetchError } = await mealQuery

      if (fetchError || !existingMeal) {
        console.error("Meal fetch error:", fetchError)
        return NextResponse.json(
          { error: "Meal not found or access denied", details: fetchError?.message },
          { status: 404 }
        )
      }

      if (existingMeal.locked) {
        return NextResponse.json(
          { error: "Cannot update locked meal" },
          { status: 403 }
        )
      }

      // Update the meal with new date and time using the actual database ID
      const { error: updateError } = await supabase
        .from("nutrition_meals")
        .update({
          date: newDate,
          time: newStartTime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMeal.id)
        .eq("user_id", user.id)

      if (updateError) {
        console.error("Meal update error:", updateError)
        return NextResponse.json(
          { error: "Failed to update meal", details: updateError.message },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { success: true, message: "Meal updated successfully" },
        { status: 200 }
      )
    }

    // Handle workout updates
    if (itemType === "workout") {
      // Extract workout ID (format: "workout-{id}")
      const workoutId = itemId.replace("workout-", "")
      
      if (!workoutId || isNaN(Number(workoutId))) {
        return NextResponse.json(
          { error: "Invalid workout ID format" },
          { status: 400 }
        )
      }

      // Check if workout exists and belongs to user
      const { data: existingWorkout, error: fetchError } = await supabase
        .from("tp_workouts")
        .select("id, planned_hours, actual_hours")
        .eq("id", Number(workoutId))
        .eq("user_id", user.id)
        .single()

      if (fetchError) {
        return NextResponse.json(
          { error: "Workout not found or access denied", details: fetchError.message },
          { status: 404 }
        )
      }

      // Update the workout with new date and time
      const { error: updateError } = await supabase
        .from("tp_workouts")
        .update({
          workout_day: newDate,
          start_time: newStartTime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", Number(workoutId))
        .eq("user_id", user.id)

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to update workout", details: updateError.message },
          { status: 500 }
        )
      }

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

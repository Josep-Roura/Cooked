import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_REGEX = /^\d{2}:\d{2}$/

interface MealWithWorkout {
  id: string
  date: string
  time: string
  duration_minutes: number
}

interface WorkoutData {
  id: number
  start_time: string | null
  planned_hours: number | null
  actual_hours: number | null
  date: string
}

// Convert time string "HH:MM" to minutes from midnight
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number)
  return hours * 60 + minutes
}

// Convert minutes from midnight to time string "HH:MM"
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
}

// Calculate if a meal would conflict with a workout
function mealConflictsWithWorkout(
  mealTime: string,
  mealDurationMinutes: number,
  workoutStart: string,
  workoutDurationHours: number,
): boolean {
  const mealStartMin = timeToMinutes(mealTime)
  const mealEndMin = mealStartMin + mealDurationMinutes
  
  const workoutStartMin = timeToMinutes(workoutStart)
  const workoutEndMin = workoutStartMin + Math.round(workoutDurationHours * 60)
  
  // Check if ranges overlap
  return mealStartMin < workoutEndMin && mealEndMin > workoutStartMin
}

// Find nearby meals that might conflict with a moved workout
async function findNearbyMeals(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  workoutDate: string,
  workoutStartTime: string,
  workoutDurationHours: number,
  windowMinutes: number = 120, // Look 2 hours before/after
): Promise<MealWithWorkout[]> {
  // Get all meals for this day
  const { data: meals, error } = await supabase
    .from("nutrition_meals")
    .select("id, date, time, duration_minutes")
    .eq("user_id", userId)
    .eq("date", workoutDate)
    .eq("locked", false) // Only adjust unlocked meals
  
  if (error || !meals) return []
  
  const workoutStartMin = timeToMinutes(workoutStartTime)
  const workoutEndMin = workoutStartMin + Math.round(workoutDurationHours * 60)
  
  // Filter meals that are within the window
  return meals.filter((meal) => {
    const mealTimeMin = timeToMinutes(meal.time)
    const mealEndMin = mealTimeMin + (meal.duration_minutes || 30)
    
    // Check if meal is within adjustment window
    const beforeStart = mealEndMin >= workoutStartMin - windowMinutes && mealEndMin <= workoutStartMin
    const afterEnd = mealTimeMin >= workoutEndMin && mealTimeMin <= workoutEndMin + windowMinutes
    const overlaps = mealConflictsWithWorkout(meal.time, meal.duration_minutes || 30, workoutStartTime, workoutDurationHours)
    
    return beforeStart || afterEnd || overlaps
  })
}

// Auto-adjust a meal to avoid conflict with workout
function adjustMealTime(
  mealTime: string,
  mealDurationMinutes: number,
  workoutStart: string,
  workoutDurationHours: number,
): string | null {
  const mealTimeMin = timeToMinutes(mealTime)
  const mealEndMin = mealTimeMin + mealDurationMinutes
  
  const workoutStartMin = timeToMinutes(workoutStart)
  const workoutEndMin = workoutStartMin + Math.round(workoutDurationHours * 60)
  
  // Check if there's a conflict
  if (!mealConflictsWithWorkout(mealTime, mealDurationMinutes, workoutStart, workoutDurationHours)) {
    return null // No conflict, no adjustment needed
  }
  
  // Try to move meal to after the workout
  const postWorkoutStart = workoutEndMin + 30 // 30 min after workout
  const postWorkoutEnd = postWorkoutStart + mealDurationMinutes
  
  // Check if after-workout slot is valid (before midnight)
  if (postWorkoutEnd <= 24 * 60) {
    return minutesToTime(postWorkoutStart)
  }
  
  // Try to move meal to before the workout
  const preWorkoutEnd = workoutStartMin - 30 // 30 min before workout
  const preWorkoutStart = preWorkoutEnd - mealDurationMinutes
  
  // Check if before-workout slot is valid (after 5 AM)
  if (preWorkoutStart >= 5 * 60) {
    return minutesToTime(preWorkoutStart)
  }
  
  // Can't auto-adjust without conflicts
  return null
}

export async function POST(req: NextRequest) {
  try {
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      console.error("[POST /api/v1/plans/auto-adjust-meals] JSON parse error:", parseError)
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      )
    }
    
    const { workoutId, workoutDate, workoutStartTime, workoutDurationHours } = body
    
    console.log(`[POST /api/v1/plans/auto-adjust-meals] Request:`, {
      workoutId,
      workoutDate,
      workoutStartTime,
      workoutDurationHours,
    })
    
    // Validate required fields
    if (!workoutId || !workoutDate || !workoutStartTime || !workoutDurationHours) {
      const error = "Missing required fields: workoutId, workoutDate, workoutStartTime, workoutDurationHours"
      console.error(`[POST /api/v1/plans/auto-adjust-meals] Validation error:`, {
        workoutId,
        workoutDate,
        workoutStartTime,
        workoutDurationHours,
      })
      return NextResponse.json({ error }, { status: 400 })
    }
    
    // Validate formats
    if (!DATE_REGEX.test(workoutDate)) {
      console.error(`[POST /api/v1/plans/auto-adjust-meals] Invalid date format:`, workoutDate)
      return NextResponse.json(
        { error: "Invalid date format. Expected: yyyy-MM-dd" },
        { status: 400 }
      )
    }
    
    if (!TIME_REGEX.test(workoutStartTime)) {
      console.error(`[POST /api/v1/plans/auto-adjust-meals] Invalid time format:`, workoutStartTime)
      return NextResponse.json(
        { error: "Invalid time format. Expected: HH:mm" },
        { status: 400 }
      )
    }
    
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error(`[POST /api/v1/plans/auto-adjust-meals] Auth error:`, authError?.message)
      return NextResponse.json(
        { error: "Not authenticated", details: authError?.message ?? null },
        { status: 401 }
      )
    }
    
    // Find nearby meals that might need adjustment
    const nearbyMeals = await findNearbyMeals(
      supabase,
      user.id,
      workoutDate,
      workoutStartTime,
      workoutDurationHours,
      120, // 2-hour window
    )
    
    console.log(`[POST /api/v1/plans/auto-adjust-meals] Found ${nearbyMeals.length} nearby meals to check`)
    
    // Attempt to auto-adjust conflicting meals
    const adjustedMeals: Array<{ id: string; oldTime: string; newTime: string }> = []
    
    for (const meal of nearbyMeals) {
      const newTime = adjustMealTime(
        meal.time,
        meal.duration_minutes || 30,
        workoutStartTime,
        workoutDurationHours,
      )
      
      if (newTime && newTime !== meal.time) {
        console.log(
          `[POST /api/v1/plans/auto-adjust-meals] Auto-adjusting meal ${meal.id}: ${meal.time} -> ${newTime}`
        )
        
        const { error: updateError } = await supabase
          .from("nutrition_meals")
          .update({
            time: newTime,
            updated_at: new Date().toISOString(),
          })
          .eq("id", meal.id)
          .eq("user_id", user.id)
          .eq("locked", false)
        
        if (!updateError) {
          adjustedMeals.push({
            id: meal.id,
            oldTime: meal.time,
            newTime,
          })
        } else {
          console.warn(
            `[POST /api/v1/plans/auto-adjust-meals] Failed to adjust meal ${meal.id}:`,
            updateError
          )
        }
      }
    }
    
    console.log(
      `[POST /api/v1/plans/auto-adjust-meals] Successfully adjusted ${adjustedMeals.length} meals`
    )
    
    return NextResponse.json(
      {
        success: true,
        message: `Auto-adjusted ${adjustedMeals.length} meals`,
        adjustedMeals,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[POST /api/v1/plans/auto-adjust-meals] Unexpected error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

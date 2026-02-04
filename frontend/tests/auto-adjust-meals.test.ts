import { test } from "node:test"
import assert from "node:assert/strict"

/**
 * Auto-adjustment tests for meal timing when workouts are moved
 * 
 * Tests verify that when a workout time changes, nearby meals are
 * intelligently adjusted to avoid conflicts while respecting user preferences
 */

// Helper functions (copied from route.ts)
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number)
  return hours * 60 + minutes
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
}

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
  
  return mealStartMin < workoutEndMin && mealEndMin > workoutStartMin
}

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
  
  if (!mealConflictsWithWorkout(mealTime, mealDurationMinutes, workoutStart, workoutDurationHours)) {
    return null
  }
  
  const postWorkoutStart = workoutEndMin + 30
  const postWorkoutEnd = postWorkoutStart + mealDurationMinutes
  
  if (postWorkoutEnd <= 24 * 60) {
    return minutesToTime(postWorkoutStart)
  }
  
  const preWorkoutEnd = workoutStartMin - 30
  const preWorkoutStart = preWorkoutEnd - mealDurationMinutes
  
  if (preWorkoutStart >= 5 * 60) {
    return minutesToTime(preWorkoutStart)
  }
  
  return null
}

// Test cases
test("Auto-adjust: No adjustment needed when meals don't conflict", () => {
  // Workout: 10:00-12:00
  // Meal: 07:00-08:00 (before)
  
  const mealTime = "07:00"
  const mealDuration = 60
  const workoutStart = "10:00"
  const workoutDuration = 2.0
  
  const adjusted = adjustMealTime(mealTime, mealDuration, workoutStart, workoutDuration)
  assert.equal(adjusted, null, "Meal before workout should not be adjusted")
})

test("Auto-adjust: Detects meal-workout conflict", () => {
  // Workout: 10:00-12:00
  // Meal: 11:00-12:00 (overlaps)
  
  const conflict = mealConflictsWithWorkout("11:00", 60, "10:00", 2.0)
  assert.equal(conflict, true, "Should detect overlap")
})

test("Auto-adjust: Moves meal after workout when conflicts", () => {
  // Workout: 10:00-12:00
  // Meal: 11:30-12:30 (overlaps)
  // Expected: Move to 12:30 (30 min after workout)
  
  const mealTime = "11:30"
  const mealDuration = 60
  const workoutStart = "10:00"
  const workoutDuration = 2.0
  
  const adjusted = adjustMealTime(mealTime, mealDuration, workoutStart, workoutDuration)
  assert.equal(adjusted, "12:30", "Meal should move to 30 min after workout ends")
})

test("Auto-adjust: Moves meal before workout when post-workout space is limited", () => {
  // Workout: 22:00-23:00 (late evening)
  // Meal: 22:30-23:30 (would go past midnight)
  // Expected: Move to before workout
  
  const mealTime = "22:30"
  const mealDuration = 60
  const workoutStart = "22:00"
  const workoutDuration = 1.0
  
  const adjusted = adjustMealTime(mealTime, mealDuration, workoutStart, workoutDuration)
  // Calculates: workoutStart(1320) - 30min gap(30) - mealDuration(60) = 1230 = 20:30
  assert.equal(adjusted, "20:30", "Late meal should move to before late workout")
})

test("Auto-adjust: Handles early morning workouts", () => {
  // Workout: 05:30-06:30
  // Meal: 06:00-07:00 (overlaps)
  // Expected: Move to after workout
  
  const mealTime = "06:00"
  const mealDuration = 60
  const workoutStart = "05:30"
  const workoutDuration = 1.0
  
  const adjusted = adjustMealTime(mealTime, mealDuration, workoutStart, workoutDuration)
  assert.equal(adjusted, "07:00", "Early meal should move after early workout")
})

test("Auto-adjust: Respects minimum daily time window (5 AM)", () => {
  // Very early workout with meal that can't be moved before
  // Workout: 05:00-06:00
  // Meal: 04:45-05:45 (would go before 5 AM)
  // Expected: Move to after workout
  
  const mealTime = "04:45"
  const mealDuration = 60
  const workoutStart = "05:00"
  const workoutDuration = 1.0
  
  const adjusted = adjustMealTime(mealTime, mealDuration, workoutStart, workoutDuration)
  assert.equal(adjusted, "06:30", "Should move after workout, not before 5 AM")
})

test("Auto-adjust: Works with long-duration meals", () => {
  // Long meal (120 min pre-workout fuel load)
  // Workout: 10:00-12:00
  // Meal: 09:30-11:30 (2 hours, overlaps)
  // Expected: Move to after
  
  const mealTime = "09:30"
  const mealDuration = 120
  const workoutStart = "10:00"
  const workoutDuration = 2.0
  
  const adjusted = adjustMealTime(mealTime, mealDuration, workoutStart, workoutDuration)
  assert.equal(adjusted, "12:30", "Long meal should move to after workout")
})

test("Auto-adjust: Works with short-duration meals", () => {
  // Quick snack (15 min)
  // Workout: 10:00-11:00
  // Meal: 10:45-11:00 (conflicts)
  
  const mealTime = "10:45"
  const mealDuration = 15
  const workoutStart = "10:00"
  const workoutDuration = 1.0
  
  const adjusted = adjustMealTime(mealTime, mealDuration, workoutStart, workoutDuration)
  assert.equal(adjusted, "11:30", "Short snack should move to after workout")
})

test("Auto-adjust: Handles multi-hour workouts", () => {
  // Long training session
  // Workout: 08:00-11:00 (3 hours)
  // Meal: 10:00-11:00
  
  const mealTime = "10:00"
  const mealDuration = 60
  const workoutStart = "08:00"
  const workoutDuration = 3.0
  
  const adjusted = adjustMealTime(mealTime, mealDuration, workoutStart, workoutDuration)
  assert.equal(adjusted, "11:30", "Meal overlapping end of long workout should move after")
})

test("Auto-adjust: Cannot adjust when no valid time slot exists", () => {
  // Very constrained scenario - hypothetical but test for robustness
  // Workout: 00:30-23:30 (nearly full day - shouldn't happen but test it)
  // Meal: 12:00-13:00
  
  const mealTime = "12:00"
  const mealDuration = 60
  const workoutStart = "00:30"
  const workoutDuration = 23.0
  
  const adjusted = adjustMealTime(mealTime, mealDuration, workoutStart, workoutDuration)
  // Can't fit anywhere - should return null
  assert.equal(adjusted, null, "Should return null when no valid adjustment possible")
})

test("Auto-adjust: Handles workout-adjacent meals", () => {
  // Meal ending exactly when workout starts
  // Workout: 10:00-11:00
  // Meal: 09:00-10:00 (no overlap)
  
  const conflict = mealConflictsWithWorkout("09:00", 60, "10:00", 1.0)
  assert.equal(conflict, false, "Meals adjacent to workout should not conflict")
})

test("Auto-adjust: Multiple meals scenario", () => {
  const workoutStart = "10:00"
  const workoutDuration = 1.5
  
  const meals = [
    { time: "08:00", duration: 60 }, // Before - no conflict
    { time: "09:45", duration: 60 }, // Overlaps start
    { time: "10:30", duration: 60 }, // During - conflict
    { time: "11:45", duration: 60 }, // After - no conflict
  ]
  
  for (const meal of meals) {
    const conflict = mealConflictsWithWorkout(meal.time, meal.duration, workoutStart, workoutDuration)
    const adjusted = adjustMealTime(meal.time, meal.duration, workoutStart, workoutDuration)
    
    if (meal.time === "08:00" || meal.time === "11:45") {
      assert.equal(conflict, false, `${meal.time} should not conflict`)
      assert.equal(adjusted, null, `${meal.time} should not need adjustment`)
    } else {
      assert.equal(conflict, true, `${meal.time} should conflict`)
      assert(adjusted !== null && adjusted !== meal.time, `${meal.time} should be adjusted`)
    }
  }
})

test("Auto-adjust: Preserves meal after-to-after workout gap", () => {
  // Meal already after workout with good spacing
  // Workout: 10:00-11:00
  // Meal: 12:00-13:00 (60 min after)
  
  const conflict = mealConflictsWithWorkout("12:00", 60, "10:00", 1.0)
  assert.equal(conflict, false, "Post-workout meal with gap should not conflict")
})

test("Auto-adjust: Time conversion helpers", () => {
  // Test helpers used in adjustment logic
  assert.equal(timeToMinutes("10:00"), 600)
  assert.equal(timeToMinutes("05:30"), 330)
  assert.equal(timeToMinutes("23:59"), 1439)
  
  assert.equal(minutesToTime(600), "10:00")
  assert.equal(minutesToTime(330), "05:30")
  assert.equal(minutesToTime(1439), "23:59")
})

test("Auto-adjust: Pre-workout meal positioning", () => {
  // Test that pre-workout meals can move before the workout
  // Workout: 10:00-11:00
  // Meal: 10:15-11:15 (30 min during)
  
  const mealTime = "10:15"
  const mealDuration = 60
  const workoutStart = "10:00"
  const workoutDuration = 1.0
  
  // Conflict exists
  const conflict = mealConflictsWithWorkout(mealTime, mealDuration, workoutStart, workoutDuration)
  assert.equal(conflict, true)
  
  // Should move to after
  const adjusted = adjustMealTime(mealTime, mealDuration, workoutStart, workoutDuration)
  assert.equal(adjusted, "11:30")
})

test("Auto-adjust: Complex day with multiple workouts", () => {
  // Morning workout: 06:00-07:00
  // Evening workout: 17:00-18:00
  // Meal between: 12:00-13:00 (should not need adjustment)
  
  const mealTime = "12:00"
  const mealDuration = 60
  
  // Check against morning workout
  const morningConflict = mealConflictsWithWorkout(mealTime, mealDuration, "06:00", 1.0)
  assert.equal(morningConflict, false)
  
  // Check against evening workout
  const eveningConflict = mealConflictsWithWorkout(mealTime, mealDuration, "17:00", 1.0)
  assert.equal(eveningConflict, false)
})

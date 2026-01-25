/**
 * @typedef {Object} TrainingSession
 * @property {string|null} workout_type
 * @property {number|null} planned_hours
 * @property {number|null} actual_hours
 */

/**
 * @param {string|null} workoutType
 */
function mapWorkoutType(workoutType) {
  if (!workoutType) return "other"
  const value = workoutType.toLowerCase()
  if (value.includes("swim")) return "swim"
  if (value.includes("bike") || value.includes("cycle")) return "bike"
  if (value.includes("run")) return "run"
  if (value.includes("strength") || value.includes("gym")) return "strength"
  return "other"
}

/**
 * @param {TrainingSession} workout
 */
function workoutDurationMinutes(workout) {
  const type = mapWorkoutType(workout.workout_type)
  const hours = workout.actual_hours ?? workout.planned_hours ?? 0
  if (type === "strength" && (!hours || hours === 0)) {
    return 60
  }
  return Math.max(0, Math.round(hours * 60))
}

/**
 * Deterministic daily nutrition targets based on weight, goal, and training load.
 * @param {{ weightKg: number, goal: string | null, sessions: TrainingSession[] }} input
 */
export function computeNutritionTargets(input) {
  const weight = Math.max(40, input.weightKg || 70)
  const goal = (input.goal ?? "maintain").toLowerCase()
  const totalMinutes = input.sessions.reduce((sum, session) => sum + workoutDurationMinutes(session), 0)

  let trainingDayType = "rest"
  if (totalMinutes >= 120) trainingDayType = "hard"
  else if (totalMinutes >= 60) trainingDayType = "moderate"
  else if (totalMinutes >= 20) trainingDayType = "easy"

  const baseCalories = goal.includes("lose") ? 28 * weight : goal.includes("performance") ? 34 * weight : 30 * weight
  const trainingCalories = trainingDayType === "hard" ? 8 * weight : trainingDayType === "moderate" ? 5 * weight : trainingDayType === "easy" ? 2 * weight : 0
  const targetKcal = Math.round(baseCalories + trainingCalories)

  const proteinPerKg = goal.includes("lose") ? 2.0 : 1.8
  const targetProtein = Math.round(weight * proteinPerKg)
  const fatPerKg = 0.9
  const targetFat = Math.round(weight * fatPerKg)

  const caloriesFromProtein = targetProtein * 4
  const caloriesFromFat = targetFat * 9
  const remainingCalories = Math.max(targetKcal - caloriesFromProtein - caloriesFromFat, 0)
  const targetCarbs = Math.round(remainingCalories / 4)

  return {
    target_kcal: targetKcal,
    target_protein_g: targetProtein,
    target_carbs_g: targetCarbs,
    target_fat_g: targetFat,
    training_day_type: trainingDayType,
    training_minutes: totalMinutes,
  }
}

export function buildRationale(targets) {
  if (targets.training_day_type === "rest") {
    return "Rest day: carbs reduced while protein stays steady for recovery."
  }
  if (targets.training_day_type === "easy") {
    return "Easy training day: slight carb increase to support light sessions."
  }
  if (targets.training_day_type === "moderate") {
    return "Moderate training day: carbs boosted to fuel training and recovery."
  }
  return "Hard training day: higher carbs and calories to meet training demand."
}

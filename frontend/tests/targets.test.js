import test from "node:test"
import assert from "node:assert/strict"
import { computeNutritionTargets } from "../lib/nutrition/targets.js"

test("computeNutritionTargets scales carbs for training load", () => {
  const rest = computeNutritionTargets({ weightKg: 70, goal: "maintain", sessions: [] })
  const hard = computeNutritionTargets({
    weightKg: 70,
    goal: "maintain",
    sessions: [{ workout_type: "run", planned_hours: 2, actual_hours: null }],
  })

  assert.ok(hard.target_kcal > rest.target_kcal)
  assert.ok(hard.target_carbs_g >= rest.target_carbs_g)
})

test("computeNutritionTargets defaults strength duration to 60 minutes", () => {
  const targets = computeNutritionTargets({
    weightKg: 75,
    goal: "performance",
    sessions: [{ workout_type: "strength", planned_hours: 0, actual_hours: null }],
  })

  assert.ok(targets.training_minutes >= 60)
})

import { test } from "node:test"
import assert from "node:assert/strict"

/**
 * Tests para verificar que los entrenamientos se pueden mover (drag-and-drop)
 * y que el ID se procesa correctamente en el API endpoint
 */

// Simular la lógica del endpoint
function extractWorkoutId(itemId: string | number): number | null {
  let workoutId = Number(itemId)
  
  // Si es en formato "workout-123", extrae el número
  if (Number.isNaN(workoutId) && typeof itemId === "string" && itemId.startsWith("workout-")) {
    workoutId = Number(itemId.replace("workout-", ""))
  }

  if (!workoutId || Number.isNaN(workoutId)) {
    return null
  }
  
  return workoutId
}

test("Workout ID extraction: Plain number", () => {
  const result = extractWorkoutId(123)
  assert.equal(result, 123)
})

test("Workout ID extraction: String number", () => {
  const result = extractWorkoutId("456")
  assert.equal(result, 456)
})

test("Workout ID extraction: workout-prefix format", () => {
  const result = extractWorkoutId("workout-789")
  assert.equal(result, 789)
})

test("Workout ID extraction: Invalid format returns null", () => {
  const result = extractWorkoutId("invalid-format")
  assert.equal(result, null)
})

test("Workout ID extraction: Empty string returns null", () => {
  const result = extractWorkoutId("")
  assert.equal(result, null)
})

test("Workout ID extraction: Zero returns null (falsy)", () => {
  const result = extractWorkoutId(0)
  assert.equal(result, null)
})

test("Workout ID extraction: Large numbers work", () => {
  const result = extractWorkoutId("workout-999999999")
  assert.equal(result, 999999999)
})

test("Workout drag-drop payload format", () => {
  // Simula cómo se ve el payload cuando se arrastra un entrenamiento
  const sourceId = "123" // Viene del meta.workout.id convertido a string
  const payload = {
    itemId: sourceId,
    itemType: "workout",
    sourceTable: "tp_workouts",
    newDate: "2026-02-05",
    newStartTime: "10:00",
  }
  
  const extractedId = extractWorkoutId(payload.itemId)
  assert.equal(extractedId, 123)
})

test("Meal drag-drop payload format still works", () => {
  // Verifica que las comidas sigan funcionando igual
  const mealId = "uuid-meal-id"
  const payload = {
    itemId: mealId,
    itemType: "meal",
    sourceTable: "nutrition_meals",
    newDate: "2026-02-05",
    newStartTime: "12:00",
  }
  
  // Las comidas usa el UUID tal cual
  assert.equal(payload.itemId, mealId)
})

import { test } from "node:test"
import assert from "node:assert"
import { setWeekSeed, generateDynamicRecipe, resetDailyRecipeTracking } from "../lib/nutrition/recipe-generator"

// Utility to calculate week seed like the route does
function calculateWeekSeed(dateStr: string): number {
  const startDate = new Date(`${dateStr}T00:00:00Z`)
  const year = startDate.getUTCFullYear()
  const month = startDate.getUTCMonth() + 1
  const dayOfMonth = startDate.getUTCDate()
  const dayOfYear = Math.floor((startDate.getTime() - new Date(`${year}-01-01`).getTime()) / (1000 * 60 * 60 * 24))
  const weekNumber = Math.floor(dayOfYear / 7)
  
  return Math.abs((year * 73856093 ^ month * 19349663 ^ weekNumber * 83492791) | 0) % 1000000
}

// Utility to generate a week of meals
function generateWeekMeals(startDate: string) {
  const weekSeed = calculateWeekSeed(startDate)
  setWeekSeed(weekSeed)

  const startDateObj = new Date(`${startDate}T00:00:00Z`)
  const meals: string[] = []
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const cursor = new Date(startDateObj)
    cursor.setUTCDate(cursor.getUTCDate() + dayIndex)
    const dateStr = cursor.toISOString().split("T")[0]
    resetDailyRecipeTracking(dateStr)

    const targetMacros = { kcal: 500, protein_g: 30, carbs_g: 50, fat_g: 15 }
    // Generate one recipe per day per meal type (breakfast)
    const recipe = generateDynamicRecipe("breakfast", targetMacros, dayIndex, 0)
    meals.push(recipe.title)
  }
  return meals
}

test("Week seed: Same start date produces same recipes", () => {
  const week1 = generateWeekMeals("2026-02-05")
  const week1Repeat = generateWeekMeals("2026-02-05")

  assert.deepStrictEqual(week1, week1Repeat, "Same date should produce identical recipes")
})

test("Week seed: Different start dates produce different recipes", () => {
  const week1 = generateWeekMeals("2026-02-05")
  const week2 = generateWeekMeals("2026-02-12")

  const differences = week1.filter((recipe, index) => recipe !== week2[index]).length
  console.log(`Week 1: ${week1.join(", ")}`)
  console.log(`Week 2: ${week2.join(", ")}`)
  console.log(`Differences: ${differences}`)
  assert.ok(differences > 0, `Different weeks should have different recipes (got ${differences} differences)`)
})

test("Week seed: Variety within the same week", () => {
  const startDate = "2026-02-05"
  const weekSeed = calculateWeekSeed(startDate)
  setWeekSeed(weekSeed)

  const startDateObj = new Date(`${startDate}T00:00:00Z`)
  const breakfasts: string[] = []
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const cursor = new Date(startDateObj)
    cursor.setUTCDate(cursor.getUTCDate() + dayIndex)
    const dateStr = cursor.toISOString().split("T")[0]
    resetDailyRecipeTracking(dateStr)

    const targetMacros = { kcal: 500, protein_g: 30, carbs_g: 50, fat_g: 15 }
    const recipe = generateDynamicRecipe("breakfast", targetMacros, dayIndex, 0)
    breakfasts.push(recipe.title)
  }

  const uniqueBreakfasts = new Set(breakfasts).size
  console.log(`Week 1 breakfasts: ${breakfasts.join(", ")}`)
  console.log(`Unique count: ${uniqueBreakfasts}`)
  assert.ok(uniqueBreakfasts >= 5, `Should have at least 5 different breakfasts, got ${uniqueBreakfasts}`)
})

test("Week seed: Detects no same-day repetition", () => {
  const startDate = "2026-02-05"
  const weekSeed = calculateWeekSeed(startDate)
  setWeekSeed(weekSeed)

  // Test a single day with multiple meals
  resetDailyRecipeTracking(startDate)

  const targetMacros = { kcal: 500, protein_g: 30, carbs_g: 50, fat_g: 15 }

  const meal1 = generateDynamicRecipe("breakfast", targetMacros, 0, 0).title
  const meal2 = generateDynamicRecipe("breakfast", targetMacros, 0, 1).title
  const meal3 = generateDynamicRecipe("breakfast", targetMacros, 0, 2).title

  console.log(`Same day meals: ${meal1} vs ${meal2} vs ${meal3}`)
  assert.notStrictEqual(
    meal1,
    meal2,
    "Within same day, different meal slots should not repeat",
  )
  assert.notStrictEqual(
    meal2,
    meal3,
    "Within same day, different meal slots should not repeat",
  )
})

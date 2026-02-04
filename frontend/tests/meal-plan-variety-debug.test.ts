import { test } from "node:test"
import { setWeekSeed, generateDynamicRecipe, resetDailyRecipeTracking } from "../lib/nutrition/recipe-generator"

test("Debug: Check week seed calculation and recipe selection", () => {
  // Week 1: Feb 5-11 (2026)
  const startDate1 = "2026-02-05"
  const startDateObj1 = new Date(`${startDate1}T00:00:00Z`)
  const weekSeed1 = Math.abs((startDateObj1.getTime() / 1000) | 0) % 1000000

  // Week 2: Feb 12-18 (2026)
  const startDate2 = "2026-02-12"
  const startDateObj2 = new Date(`${startDate2}T00:00:00Z`)
  const weekSeed2 = Math.abs((startDateObj2.getTime() / 1000) | 0) % 1000000

  console.log(`\nWeek 1 (${startDate1}): weekSeed = ${weekSeed1}`)
  console.log(`Week 2 (${startDate2}): weekSeed = ${weekSeed2}`)

  // Generate first breakfast for each week
  setWeekSeed(weekSeed1)
  resetDailyRecipeTracking(startDate1)
  const targetMacros = { kcal: 500, protein_g: 30, carbs_g: 50, fat_g: 15 }
  const recipe1 = generateDynamicRecipe("breakfast", targetMacros, 0, 0)

  setWeekSeed(weekSeed2)
  resetDailyRecipeTracking(startDate2)
  const recipe2 = generateDynamicRecipe("breakfast", targetMacros, 0, 0)

  console.log(`\nWeek 1, Day 0, Meal 0 breakfast: ${recipe1.title}`)
  console.log(`Week 2, Day 0, Meal 0 breakfast: ${recipe2.title}`)
  console.log(`Are they different? ${recipe1.title !== recipe2.title}`)

  // Generate all 7 days for week 1
  console.log(`\nWeek 1 breakfasts:`)
  setWeekSeed(weekSeed1)
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const cursor = new Date(startDateObj1)
    cursor.setUTCDate(cursor.getUTCDate() + dayIndex)
    const dateStr = cursor.toISOString().split("T")[0]
    resetDailyRecipeTracking(dateStr)
    const recipe = generateDynamicRecipe("breakfast", targetMacros, dayIndex, 0)
    console.log(`  Day ${dayIndex}: ${recipe.title}`)
  }

  // Generate all 7 days for week 2
  console.log(`\nWeek 2 breakfasts:`)
  setWeekSeed(weekSeed2)
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const cursor = new Date(startDateObj2)
    cursor.setUTCDate(cursor.getUTCDate() + dayIndex)
    const dateStr = cursor.toISOString().split("T")[0]
    resetDailyRecipeTracking(dateStr)
    const recipe = generateDynamicRecipe("breakfast", targetMacros, dayIndex, 0)
    console.log(`  Day ${dayIndex}: ${recipe.title}`)
  }
})

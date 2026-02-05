import { test } from "node:test"
import assert from "node:assert"
import { buildWeeklyPlan } from "../lib/nutrition/weeklyPlanner"
import { selectRecipe, fallbackRecipePool, type RecipePool } from "../lib/nutrition/recipeSelector"
import { mergeMealUpdate } from "../lib/nutrition/mealUpdate"
import { computeFuelingTargets } from "../lib/nutrition/workoutFuelingEngine"

const recipePool: RecipePool = {
  candidates: [],
  fallback: fallbackRecipePool,
}

function countTitles(titles: string[]) {
  return titles.reduce((map, title) => {
    const key = title.toLowerCase()
    map.set(key, (map.get(key) ?? 0) + 1)
    return map
  }, new Map<string, number>())
}

test("Weekly planner enforces >=30 min gaps between meals", () => {
  const plan = buildWeeklyPlan({
    start: "2026-02-03",
    end: "2026-02-03",
    profile: { weight_kg: 75, meals_per_day: 4 },
    workouts: [
      {
        workout_day: "2026-02-03",
        workout_type: "bike",
        planned_hours: 1.5,
        actual_hours: null,
        tss: 90,
        if: 0.8,
        rpe: 6,
        title: "Intervals",
        start_time: "10:00",
      },
    ],
  })

  const day = plan[0]
  const times = day.meals.map((meal) => meal.time).sort()
  for (let i = 1; i < times.length; i++) {
    const [prevH, prevM] = times[i - 1].split(":").map(Number)
    const [currH, currM] = times[i].split(":").map(Number)
    const prev = prevH * 60 + prevM
    const curr = currH * 60 + currM
    assert.ok(curr - prev >= 30, `Expected >=30 min gap, got ${curr - prev}`)
  }
})

test("Recipe selection never exceeds 2x repetition across the week", () => {
  const plan = buildWeeklyPlan({
    start: "2026-02-03",
    end: "2026-02-09",
    profile: { weight_kg: 70, meals_per_day: 4 },
    workouts: [],
  })

  const usedTitles = new Map<string, number>()
  const titles: string[] = []
  plan.forEach((day) => {
    day.meals.forEach((meal) => {
      const recipe = selectRecipe({
        mealType: meal.meal_type,
        targetMacros: meal.target_macros,
        usedTitles,
        profile: { diet: null, allergies: [] },
        pool: recipePool,
      })
      titles.push(recipe.title)
      const key = recipe.title.toLowerCase()
      usedTitles.set(key, (usedTitles.get(key) ?? 0) + 1)
    })
  })

  const counts = countTitles(titles)
  for (const [title, count] of counts.entries()) {
    assert.ok(count <= 2, `Expected ${title} to appear <=2x, got ${count}`)
  }
})

test("Selected recipes always include steps", () => {
  const plan = buildWeeklyPlan({
    start: "2026-02-05",
    end: "2026-02-05",
    profile: { weight_kg: 75, meals_per_day: 4 },
    workouts: [],
  })

  const usedTitles = new Map<string, number>()
  plan[0].meals.forEach((meal) => {
    const recipe = selectRecipe({
      mealType: meal.meal_type,
      targetMacros: meal.target_macros,
      usedTitles,
      profile: { diet: null, allergies: [] },
      pool: recipePool,
    })
    assert.ok(recipe.steps.length > 0, "Expected recipe steps to be populated")
    const key = recipe.title.toLowerCase()
    usedTitles.set(key, (usedTitles.get(key) ?? 0) + 1)
  })
})

test("Meal updates preserve recipe/ingredients when omitted", () => {
  const existing = { recipe: { title: "Test Recipe" }, ingredients: [{ name: "Oats" }] }
  const merged = mergeMealUpdate(existing, { recipe: undefined, ingredients: undefined })
  assert.deepStrictEqual(merged.recipe, existing.recipe)
  assert.deepStrictEqual(merged.ingredients, existing.ingredients)
})

test("Workout fueling targets assign carbs for 90-minute moderate workout", () => {
  const targets = computeFuelingTargets(
    {
      weight_kg: 70,
      age: 30,
      sex: "male",
      experience_level: "intermediate",
      sweat_rate: "medium",
      gi_sensitivity: "low",
      caffeine_use: "some",
      primary_goal: "maintenance",
    },
    {
      sport: "run",
      duration_min: 90,
      intensity: "moderate",
      start_time: "08:00",
    },
  )

  assert.ok(targets.carbs_g_per_h > 0, "Expected carbs/h > 0 for 90-min moderate workout")
})

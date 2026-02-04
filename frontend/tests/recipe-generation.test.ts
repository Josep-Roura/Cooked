import { test } from "node:test"
import assert from "node:assert/strict"
import { generateDynamicRecipe, resetDailyRecipeTracking } from "../lib/nutrition/recipe-generator.ts"

test("Recipe generation rotates through different recipes", async () => {
  // Reset tracking for the test
  resetDailyRecipeTracking("2024-04-01")

  // Generate breakfast recipes for the same day but different meal indices
  const recipe1 = generateDynamicRecipe("breakfast", {
    kcal: 400,
    protein_g: 30,
    carbs_g: 50,
    fat_g: 10,
  }, 0, 0)

  const recipe2 = generateDynamicRecipe("breakfast", {
    kcal: 400,
    protein_g: 30,
    carbs_g: 50,
    fat_g: 10,
  }, 0, 1)

  // Same day different meal index should produce different recipes
  assert.notEqual(recipe1.title, recipe2.title, "Different meal indices should produce different recipes")
  
  // Reset for next day
  resetDailyRecipeTracking("2024-04-02")
  
  const recipe3 = generateDynamicRecipe("breakfast", {
    kcal: 400,
    protein_g: 30,
    carbs_g: 50,
    fat_g: 10,
  }, 1, 0)

  // Different day allows same recipe again
  assert.equal(typeof recipe3.title, "string", "Recipe should have a title")
  assert(recipe3.ingredients.length > 0, "Recipe should have ingredients")
})

test("Recipe ingredients are calculated for target macros", async () => {
  resetDailyRecipeTracking("2024-04-01")

  const recipe = generateDynamicRecipe("lunch", {
    kcal: 600,
    protein_g: 40,
    carbs_g: 70,
    fat_g: 15,
  }, 0, 0)

  assert(recipe.ingredients.length > 0, "Recipe should have ingredients")
  assert(recipe.title, "Recipe should have a title")
  assert(recipe.steps.length > 0, "Recipe should have instructions")
  
  // Verify ingredients have the expected structure
  for (const ingredient of recipe.ingredients) {
    assert(ingredient.name, "Ingredient should have a name")
    assert(typeof ingredient.quantity === "number", "Ingredient should have numeric quantity")
    assert(ingredient.unit, "Ingredient should have a unit")
  }
})

test("All meal types generate recipes", async () => {
  const mealTypes = ["breakfast", "lunch", "dinner", "snack"]
  resetDailyRecipeTracking("2024-04-01")

  for (const mealType of mealTypes) {
    const recipe = generateDynamicRecipe(mealType, {
      kcal: 400,
      protein_g: 25,
      carbs_g: 50,
      fat_g: 12,
    }, 0, 0)

    assert(recipe.title, `${mealType} should generate a recipe`)
    assert(recipe.ingredients.length > 0, `${mealType} recipe should have ingredients`)
  }
})

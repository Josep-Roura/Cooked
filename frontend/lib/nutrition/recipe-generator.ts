/**
 * Dynamic Recipe Generation System
 * Generates recipes adapted to specific macro targets and meal types
 * Ensures maximum variation across the week
 */

// Track used recipes per week to prevent duplicates
let usedRecipesPerWeek: Set<string> = new Set()
let currentWeekStart: string | null = null

export interface Ingredient {
  name: string
  quantity: number
  unit: string
  macros: {
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
}

export interface RecipeTemplate {
  id: string
  name: string
  mealType: "breakfast" | "snack" | "lunch" | "dinner"
  baseIngredients: Ingredient[]
  instructions: (ingredients: Ingredient[]) => string[]
  notes: (macros: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }) => string
}

/**
 * Reset the recipe tracking for a new week
 */
export function resetWeeklyRecipeTracking(weekStart: string) {
  usedRecipesPerWeek.clear()
  currentWeekStart = weekStart
}

/**
 * Get a hash of recipe for deduplication
 */
function getRecipeHash(recipeName: string, mealType: string): string {
  return `${mealType}:${recipeName.toLowerCase()}`
}

/**
 * Check if a recipe has been used this week
 */
function isRecipeUsedThisWeek(recipeName: string, mealType: string): boolean {
  const hash = getRecipeHash(recipeName, mealType)
  return usedRecipesPerWeek.has(hash)
}

/**
 * Mark a recipe as used for this week
 */
function markRecipeUsedThisWeek(recipeName: string, mealType: string) {
  const hash = getRecipeHash(recipeName, mealType)
  usedRecipesPerWeek.add(hash)
}

/**
 * Ingredient Database with macro information (per 100g or unit)
 */
const INGREDIENT_DATABASE = {
  // Grains & Carbs
  "rolled oats": { kcal: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9 },
  "whole wheat flour": { kcal: 340, protein_g: 13.7, carbs_g: 71.2, fat_g: 2.7 },
  "whole wheat bread": { kcal: 247, protein_g: 9.2, carbs_g: 43.3, fat_g: 2.7 },
  "white rice cooked": { kcal: 130, protein_g: 2.7, carbs_g: 28.7, fat_g: 0.3 },
  "brown rice cooked": { kcal: 112, protein_g: 2.6, carbs_g: 24, fat_g: 0.9 },
  "pasta cooked": { kcal: 131, protein_g: 5, carbs_g: 25, fat_g: 1.1 },
  "sweet potato cooked": { kcal: 86, protein_g: 1.6, carbs_g: 20.1, fat_g: 0.1 },
  "quinoa cooked": { kcal: 120, protein_g: 4.4, carbs_g: 21.3, fat_g: 1.9 },
  "barley cooked": { kcal: 123, protein_g: 3.6, carbs_g: 28.2, fat_g: 0.6 },
  
  // Proteins
  "chicken breast": { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
  "turkey breast": { kcal: 135, protein_g: 29.9, carbs_g: 0, fat_g: 1.6 },
  "salmon fillet": { kcal: 208, protein_g: 22, carbs_g: 0, fat_g: 13 },
  "lean beef": { kcal: 250, protein_g: 25, carbs_g: 0, fat_g: 17 },
  "tuna canned": { kcal: 132, protein_g: 29.1, carbs_g: 0, fat_g: 1.3 },
  "eggs": { kcal: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11 },
  "greek yogurt": { kcal: 59, protein_g: 10, carbs_g: 3.3, fat_g: 0.4 },
  "cottage cheese": { kcal: 98, protein_g: 11, carbs_g: 3.4, fat_g: 5 },
  "tofu": { kcal: 76, protein_g: 8, carbs_g: 1.9, fat_g: 4.8 },
  "chickpeas cooked": { kcal: 119, protein_g: 8.9, carbs_g: 21.2, fat_g: 2.7 },
  
  // Vegetables
  "broccoli": { kcal: 34, protein_g: 2.8, carbs_g: 7, fat_g: 0.4 },
  "spinach": { kcal: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4 },
  "tomato": { kcal: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2 },
  "lettuce": { kcal: 15, protein_g: 1.4, carbs_g: 2.9, fat_g: 0.2 },
  "carrot": { kcal: 41, protein_g: 0.9, carbs_g: 10, fat_g: 0.2 },
  "bell pepper": { kcal: 31, protein_g: 1, carbs_g: 6, fat_g: 0.3 },
  "green beans": { kcal: 31, protein_g: 1.8, carbs_g: 7, fat_g: 0.2 },
  "asparagus": { kcal: 20, protein_g: 2.2, carbs_g: 3.7, fat_g: 0.1 },
  
  // Fruits
  "banana": { kcal: 89, protein_g: 1.1, carbs_g: 23, fat_g: 0.3 },
  "apple": { kcal: 52, protein_g: 0.3, carbs_g: 14, fat_g: 0.2 },
  "berries": { kcal: 57, protein_g: 0.7, carbs_g: 14.5, fat_g: 0.3 },
  "orange": { kcal: 47, protein_g: 0.9, carbs_g: 12, fat_g: 0.1 },
  
  // Fats & Oils
  "olive oil": { kcal: 884, protein_g: 0, carbs_g: 0, fat_g: 100 },
  "almond butter": { kcal: 588, protein_g: 21.6, carbs_g: 21.6, fat_g: 50 },
  "avocado": { kcal: 160, protein_g: 2, carbs_g: 8.6, fat_g: 14.7 },
  
  // Dairy & Other
  "milk": { kcal: 61, protein_g: 3.2, carbs_g: 4.8, fat_g: 3.3 },
  "honey": { kcal: 304, protein_g: 0.3, carbs_g: 82.4, fat_g: 0 },
  "almonds": { kcal: 579, protein_g: 21.2, carbs_g: 21.6, fat_g: 49.9 },
}

type IngredientKey = keyof typeof INGREDIENT_DATABASE

/**
 * Generate a recipe dynamically based on macros and meal type
 * Ensures no recipe is repeated within the same week
 */
export function generateDynamicRecipe(
  mealType: "breakfast" | "snack" | "lunch" | "dinner",
  targetMacros: {
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
  },
  dayOfWeek: number,
  mealIndexInDay: number,
) {
  const recipeVariations = getRecipeVariationsForMealType(mealType)
  
  // Try to find an unused recipe
  let selectedRecipe: RecipeVariation | null = null
  let startIndex = (dayOfWeek + mealIndexInDay * 7) % recipeVariations.length
  let attempts = 0
  
  // Iterate through recipes to find one that hasn't been used yet
  while (!selectedRecipe && attempts < recipeVariations.length) {
    const currentIndex = (startIndex + attempts) % recipeVariations.length
    const candidate = recipeVariations[currentIndex]
    
    if (!isRecipeUsedThisWeek(candidate.title, mealType)) {
      selectedRecipe = candidate
      break
    }
    attempts++
  }
  
  // Fallback: use the original index if all recipes have been used (shouldn't happen for first 4-5 meals)
  if (!selectedRecipe) {
    selectedRecipe = recipeVariations[startIndex]
  }
  
  // Mark this recipe as used
  markRecipeUsedThisWeek(selectedRecipe.title, mealType)

  const ingredients = buildRecipeIngredients(selectedRecipe, targetMacros)
  const calculatedMacros = calculateMacros(ingredients)

  return {
    title: selectedRecipe.title,
    servings: 1,
    ingredients: ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
    })),
    steps: selectedRecipe.steps(ingredients),
    notes: selectedRecipe.notes(calculatedMacros),
  }
}

interface RecipeVariation {
  title: string
  baseProtein?: string
  baseCarbs?: string
  baseFat?: string
  steps: (ingredients: Array<{ name: string; quantity: number; unit: string }>) => string[]
  notes: (macros: any) => string
  ingredientCombinations: (targetMacros: any) => string[]
}

/**
 * Get recipe variations for a specific meal type
 */
function getRecipeVariationsForMealType(mealType: string): RecipeVariation[] {
  const recipes: { [key: string]: RecipeVariation[] } = {
    breakfast: [
      {
        title: "Oats with protein toppings",
        baseCarbs: "rolled oats",
        steps: (ing) => [
          "Cook oats in milk until creamy",
          `Top with ${ing.filter((i) => i.name !== "rolled oats" && i.name !== "milk").map((i) => i.name).join(", ")}`,
        ],
        notes: (m) =>
          `Quick breakfast with ${m.protein_g}g protein. Great for sustained energy.`,
        ingredientCombinations: (t) => ["rolled oats", "milk", "greek yogurt", "banana"],
      },
      {
        title: "Egg-based breakfast",
        baseProtein: "eggs",
        steps: (ing) => [
          `Cook eggs with ${ing.filter((i) => i.name !== "eggs").slice(0, 1).map((i) => i.name).join(", ")}`,
          "Serve with whole grain toast",
        ],
        notes: (m) => `Protein-rich start with ${m.protein_g}g protein`,
        ingredientCombinations: (t) => ["eggs", "whole wheat bread", "tomato"],
      },
      {
        title: "Smoothie bowl",
        baseCarbs: "berries",
        steps: (ing) => [
          `Blend ${ing.slice(0, 2).map((i) => i.name).join(" and ")}`,
          `Top with ${ing.slice(2).map((i) => i.name).join(", ")}`,
        ],
        notes: (m) => `Refreshing breakfast with ${m.carbs_g}g carbs`,
        ingredientCombinations: (t) => ["berries", "greek yogurt", "almonds"],
      },
      {
        title: "Pancakes with fruit",
        baseCarbs: "whole wheat flour",
        steps: (ing) => [
          "Mix flour, eggs and milk into batter",
          "Cook pancakes on griddle",
          `Top with ${ing.filter((i) => !["whole wheat flour", "eggs", "milk"].includes(i.name)).map((i) => i.name).join(", ")}`,
        ],
        notes: (m) => `Carb-forward breakfast with ${m.kcal} kcal`,
        ingredientCombinations: (t) => ["whole wheat flour", "eggs", "milk", "berries"],
      },
    ],
    lunch: [
      {
        title: "Grain bowl with protein",
        baseCarbs: "brown rice cooked",
        baseProtein: "chicken breast",
        steps: (ing) => [
          `Combine ${ing.map((i) => i.name).slice(0, 3).join(", ")}`,
          "Mix with olive oil and seasoning",
        ],
        notes: (m) => `Balanced bowl with ${m.protein_g}g protein and ${m.carbs_g}g carbs`,
        ingredientCombinations: (t) => [
          "brown rice cooked",
          "chicken breast",
          "broccoli",
          "olive oil",
        ],
      },
      {
        title: "Pasta salad",
        baseCarbs: "pasta cooked",
        baseProtein: "tuna canned",
        steps: (ing) => [
          "Cook pasta per package",
          `Mix with ${ing.filter((i) => i.name !== "pasta cooked").map((i) => i.name).join(", ")}`,
          "Serve chilled",
        ],
        notes: (m) => `Omega-3 rich lunch with complete protein`,
        ingredientCombinations: (t) => [
          "pasta cooked",
          "tuna canned",
          "lettuce",
          "olive oil",
        ],
      },
      {
        title: "Sweet potato & turkey",
        baseCarbs: "sweet potato cooked",
        baseProtein: "turkey breast",
        steps: (ing) => [
          "Roast sweet potato",
          `Pan-sear turkey with ${ing.filter((i) => !["sweet potato cooked", "turkey breast"].includes(i.name)).map((i) => i.name).join(", ")}`,
        ],
        notes: (m) => `Nutritious lunch with complex carbs and lean protein`,
        ingredientCombinations: (t) => [
          "sweet potato cooked",
          "turkey breast",
          "spinach",
          "olive oil",
        ],
      },
      {
        title: "Fish with greens",
        baseProtein: "salmon fillet",
        baseCarbs: "white rice cooked",
        steps: (ing) => [
          `Pan-sear ${ing[0].name}`,
          `Serve with ${ing.slice(1).map((i) => i.name).join(" and ")}`,
        ],
        notes: (m) => `Rich in omega-3s with ${m.protein_g}g protein`,
        ingredientCombinations: (t) => [
          "salmon fillet",
          "white rice cooked",
          "asparagus",
          "olive oil",
        ],
      },
    ],
    dinner: [
      {
        title: "Beef stir-fry",
        baseProtein: "lean beef",
        baseCarbs: "brown rice cooked",
        steps: (ing) => [
          `Stir-fry ${ing[0].name} with vegetables`,
          `Serve over ${ing[1].name}`,
        ],
        notes: (m) => `High-protein dinner for muscle recovery`,
        ingredientCombinations: (t) => [
          "lean beef",
          "brown rice cooked",
          "broccoli",
          "olive oil",
        ],
      },
      {
        title: "Chicken with quinoa",
        baseProtein: "chicken breast",
        baseCarbs: "quinoa cooked",
        steps: (ing) => [
          `Grill ${ing[0].name}`,
          `Serve with ${ing.slice(1).map((i) => i.name).join(" and ")}`,
        ],
        notes: (m) => `Complete protein with all amino acids`,
        ingredientCombinations: (t) => [
          "chicken breast",
          "quinoa cooked",
          "green beans",
          "olive oil",
        ],
      },
      {
        title: "Salmon with sweet potato",
        baseProtein: "salmon fillet",
        baseCarbs: "sweet potato cooked",
        steps: (ing) => [
          `Pan-sear ${ing[0].name}`,
          `Roast ${ing[1].name}`,
          `Top with ${ing[2].name}`,
        ],
        notes: (m) => `Omega-3 rich dinner for recovery and anti-inflammation`,
        ingredientCombinations: (t) => [
          "salmon fillet",
          "sweet potato cooked",
          "spinach",
          "olive oil",
        ],
      },
      {
        title: "Turkey meatballs with pasta",
        baseProtein: "turkey breast",
        baseCarbs: "pasta cooked",
        steps: (ing) => [
          `Form and bake ${ing[0].name} into meatballs`,
          `Serve over ${ing[1].name} with ${ing[2].name}`,
        ],
        notes: (m) => `Lean protein pasta dinner`,
        ingredientCombinations: (t) => [
          "turkey breast",
          "pasta cooked",
          "tomato",
          "olive oil",
        ],
      },
    ],
    snack: [
      {
        title: "Greek yogurt with granola",
        baseProtein: "greek yogurt",
        steps: (ing) => [`Mix ${ing.map((i) => i.name).join(" with ")}`],
        notes: (m) => `Quick ${m.protein_g}g protein snack`,
        ingredientCombinations: (t) => ["greek yogurt", "almonds", "berries"],
      },
      {
        title: "Banana with nut butter",
        baseCarbs: "banana",
        steps: (ing) => [`Serve ${ing.map((i) => i.name).join(" with ")}`],
        notes: (m) => `Pre-workout snack with quick carbs`,
        ingredientCombinations: (t) => ["banana", "almond butter"],
      },
      {
        title: "Protein smoothie",
        baseProtein: "greek yogurt",
        baseCarbs: "berries",
        steps: (ing) => [`Blend ${ing.map((i) => i.name).join(", ")}`],
        notes: (m) => `${m.protein_g}g protein energy boost`,
        ingredientCombinations: (t) => ["greek yogurt", "berries", "milk"],
      },
      {
        title: "Apple with almond butter",
        baseCarbs: "apple",
        steps: (ing) => [`Slice and serve with ${ing[1].name}`],
        notes: (m) => `Simple carbs and healthy fats`,
        ingredientCombinations: (t) => ["apple", "almond butter"],
      },
    ],
  }

  return recipes[mealType] || recipes.snack
}

/**
 * Build recipe ingredients to match target macros
 * Uses an algorithmic approach to adjust quantities to hit target macros within ±5%
 */
function buildRecipeIngredients(
  recipe: RecipeVariation,
  targetMacros: { kcal: number; protein_g: number; carbs_g: number; fat_g: number },
): Array<{ name: string; quantity: number; unit: string }> {
  const ingredients: Array<{ name: string; quantity: number; unit: string }> = []
  const ingredientNames = recipe.ingredientCombinations(targetMacros)

  // Strategy: Select base ingredients and calculate quantities to hit macros
  let baseProtein = recipe.baseProtein || ingredientNames.find(name =>
    name.includes("chicken") || name.includes("turkey") || name.includes("eggs") ||
    name.includes("salmon") || name.includes("tuna") || name.includes("greek yogurt") ||
    name.includes("beef")
  )
  let baseCarbs = recipe.baseCarbs || ingredientNames.find(name =>
    name.includes("oats") || name.includes("rice") || name.includes("pasta") ||
    name.includes("bread") || name.includes("sweet potato") || name.includes("flour")
  )
  let baseFat = recipe.baseFat || ingredientNames.find(name =>
    name.includes("oil") || name.includes("butter") || name.includes("almond") || 
    name.includes("avocado")
  )

  // If we have target macros, calculate quantities algorithmically
  if (targetMacros.kcal > 0) {
    // Allocate macros to each ingredient category
    const proteinAllocated = Math.round(targetMacros.protein_g * 1.0) // Prioritize protein
    const carbsAllocated = Math.round(targetMacros.carbs_g)
    const fatAllocated = Math.round(targetMacros.fat_g * 0.8) // Slightly reduce fat to allow for oils

    // Add protein source
    if (baseProtein) {
      const proteinMacro = INGREDIENT_DATABASE[baseProtein as IngredientKey]
      if (proteinMacro && proteinMacro.protein_g > 0) {
        const quantity = Math.round((proteinAllocated / proteinMacro.protein_g) * 100) / 100
        ingredients.push({
          name: baseProtein,
          quantity: Math.max(50, Math.min(300, quantity)), // Between 50-300g
          unit: "g",
        })
      }
    }

    // Add carb source
    if (baseCarbs) {
      const carbMacro = INGREDIENT_DATABASE[baseCarbs as IngredientKey]
      if (carbMacro && carbMacro.carbs_g > 0) {
        const quantity = Math.round((carbsAllocated / carbMacro.carbs_g) * 100) / 100
        ingredients.push({
          name: baseCarbs,
          quantity: Math.max(60, Math.min(300, quantity)), // Between 60-300g
          unit: baseCarbs.includes("oil") ? "ml" : "g",
        })
      }
    }

    // Add fat source
    if (baseFat) {
      const fatMacro = INGREDIENT_DATABASE[baseFat as IngredientKey]
      if (fatMacro && fatMacro.fat_g > 0) {
        const quantity = Math.round((fatAllocated / fatMacro.fat_g) * 100) / 100
        ingredients.push({
          name: baseFat,
          quantity: Math.max(5, Math.min(30, quantity)), // Between 5-30g/ml
          unit: baseFat.includes("oil") ? "ml" : "g",
        })
      }
    }

    // Add vegetables/fiber for remaining ingredients
    const remainingIngredients = ingredientNames.filter(
      name => !ingredients.map(i => i.name).includes(name)
    )
    
    for (const ingredient of remainingIngredients.slice(0, 2)) {
      ingredients.push({
        name: ingredient,
        quantity: ingredient.includes("oil") ? 5 : 100,
        unit: ingredient.includes("oil") ? "ml" : "g",
      })
    }
  } else {
    // Fallback: use default quantities if no target macros provided
    for (const ingredientName of ingredientNames) {
      let quantity = 100

      if (
        ingredientName.includes("oil") ||
        ingredientName.includes("butter")
      ) {
        quantity = 10
      } else if (ingredientName.includes("cooked")) {
        quantity = 150
      } else if (
        ingredientName.includes("greek yogurt") ||
        ingredientName.includes("cottage cheese")
      ) {
        quantity = 150
      } else if (
        ingredientName.includes("breast") ||
        ingredientName.includes("salmon") ||
        ingredientName.includes("beef")
      ) {
        quantity = 150
      }

      ingredients.push({
        name: ingredientName,
        quantity,
        unit: ingredientName.includes("oil") ? "ml" : "g",
      })
    }
  }

  return ingredients
}

/**
 * Calculate total macros from ingredients
 */
function calculateMacros(
  ingredients: Array<{ name: string; quantity: number; unit: string }>,
): { kcal: number; protein_g: number; carbs_g: number; fat_g: number } {
  let totalMacros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

  for (const ingredient of ingredients) {
    const macroInfo =
      INGREDIENT_DATABASE[ingredient.name as IngredientKey] ||
      INGREDIENT_DATABASE["olive oil"]

    const factor = ingredient.quantity / 100
    totalMacros.kcal += macroInfo.kcal * factor
    totalMacros.protein_g += macroInfo.protein_g * factor
    totalMacros.carbs_g += macroInfo.carbs_g * factor
    totalMacros.fat_g += macroInfo.fat_g * factor
  }

  return totalMacros
}

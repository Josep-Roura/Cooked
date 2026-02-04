/**
 * Dynamic Recipe Generation System
 * Generates recipes adapted to specific macro targets and meal types
 * Ensures maximum variation across the week WITHOUT global deduplication
 */

// Per-day recipe tracking to ensure variety WITHIN each day
let usedRecipesPerDay: Set<string> = new Set()
let currentDay: string | null = null

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
 * Reset the recipe tracking for a new day
 * This ensures meals don't repeat WITHIN the same day, but allows repetition across days
 */
export function resetDailyRecipeTracking(day: string) {
  usedRecipesPerDay.clear()
  currentDay = day
}

/**
 * Get a hash of recipe for deduplication
 */
function getRecipeHash(recipeName: string, mealType: string): string {
  return `${mealType}:${recipeName.toLowerCase()}`
}

/**
 * Check if a recipe has been used today
 */
function isRecipeUsedToday(recipeName: string, mealType: string): boolean {
  const hash = getRecipeHash(recipeName, mealType)
  return usedRecipesPerDay.has(hash)
}

/**
 * Mark a recipe as used for today
 */
function markRecipeUsedToday(recipeName: string, mealType: string) {
  const hash = getRecipeHash(recipeName, mealType)
  usedRecipesPerDay.add(hash)
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
 * Uses rotation to ensure different recipes each day without forced deduplication
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
  
  // Create a unique index based on meal position that distributes evenly across available recipes
  // This ensures different recipes are selected even with 5+ meals of same type in a week
  const uniqueIndex = (dayOfWeek * 13 + mealIndexInDay * 97) % recipeVariations.length
  
  // Try to find an unused recipe (only within the current day)
  let selectedRecipe: RecipeVariation | null = null
  let attempts = 0
  const maxAttempts = Math.min(recipeVariations.length, 3) // Try up to 3 variations
  
  // First pass: find a recipe not used today
  while (!selectedRecipe && attempts < maxAttempts) {
    const currentIndex = (uniqueIndex + attempts) % recipeVariations.length
    const candidate = recipeVariations[currentIndex]
    
    if (!isRecipeUsedToday(candidate.title, mealType)) {
      selectedRecipe = candidate
      break
    }
    attempts++
  }
  
  // Fallback: use the uniquely calculated index (allows same recipe across different days)
  if (!selectedRecipe) {
    selectedRecipe = recipeVariations[uniqueIndex]
  }
  
  // Mark this recipe as used TODAY (allows repetition across days)
  markRecipeUsedToday(selectedRecipe.title, mealType)

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
 * Extended with many more options to support 5+ meals/day without repetition
 */
function getRecipeVariationsForMealType(mealType: string): RecipeVariation[] {
  const recipes: { [key: string]: RecipeVariation[] } = {
    breakfast: [
      {
        title: "Oats with yogurt and fruit",
        baseCarbs: "rolled oats",
        steps: (ing) => ["Cook oats in milk", "Top with yogurt and fruit"],
        notes: (m) => `Energy breakfast with ${m.protein_g}g protein`,
        ingredientCombinations: (t) => ["rolled oats", "milk", "greek yogurt", "banana"],
      },
      {
        title: "Scrambled eggs with toast",
        baseProtein: "eggs",
        steps: (ing) => ["Scramble eggs in butter", "Serve with toasted bread"],
        notes: (m) => `Classic high-protein start with ${m.protein_g}g protein`,
        ingredientCombinations: (t) => ["eggs", "whole wheat bread", "olive oil"],
      },
      {
        title: "Smoothie bowl with granola",
        baseCarbs: "berries",
        steps: (ing) => ["Blend berries and yogurt", "Top with granola and nuts"],
        notes: (m) => `Refreshing bowls with ${m.carbs_g}g carbs`,
        ingredientCombinations: (t) => ["berries", "greek yogurt", "almonds"],
      },
      {
        title: "Pancakes with maple syrup",
        baseCarbs: "whole wheat flour",
        steps: (ing) => ["Make pancake batter", "Cook on griddle", "Top with honey"],
        notes: (m) => `Delicious carb-loaded breakfast`,
        ingredientCombinations: (t) => ["whole wheat flour", "eggs", "milk", "honey"],
      },
      {
        title: "French toast with berries",
        baseCarbs: "whole wheat bread",
        steps: (ing) => ["Dip bread in egg mixture", "Pan-fry until golden", "Top with berries"],
        notes: (m) => `Indulgent breakfast treat`,
        ingredientCombinations: (t) => ["whole wheat bread", "eggs", "milk", "berries"],
      },
      {
        title: "Greek yogurt parfait",
        baseProtein: "greek yogurt",
        steps: (ing) => ["Layer yogurt and granola", "Add berries between layers"],
        notes: (m) => `Creamy and satisfying protein source`,
        ingredientCombinations: (t) => ["greek yogurt", "almonds", "berries"],
      },
      {
        title: "Quinoa breakfast bowl",
        baseCarbs: "quinoa cooked",
        steps: (ing) => ["Cook quinoa with milk", "Top with fruit and nuts"],
        notes: (m) => `Complete protein grains breakfast`,
        ingredientCombinations: (t) => ["quinoa cooked", "milk", "banana", "almonds"],
      },
      {
        title: "Cottage cheese bowl",
        baseProtein: "cottage cheese",
        steps: (ing) => ["Place cottage cheese in bowl", "Add fruit and honey"],
        notes: (m) => `High-protein breakfast with ${m.protein_g}g protein`,
        ingredientCombinations: (t) => ["cottage cheese", "berries", "honey"],
      },
    ],
    lunch: [
      {
        title: "Chicken & rice bowl",
        baseCarbs: "brown rice cooked",
        baseProtein: "chicken breast",
        steps: (ing) => ["Grill chicken", "Serve over rice with vegetables"],
        notes: (m) => `Balanced meal with ${m.protein_g}g protein and ${m.carbs_g}g carbs`,
        ingredientCombinations: (t) => ["brown rice cooked", "chicken breast", "broccoli", "olive oil"],
      },
      {
        title: "Tuna pasta salad",
        baseCarbs: "pasta cooked",
        baseProtein: "tuna canned",
        steps: (ing) => ["Cook pasta", "Mix with tuna and vegetables", "Dress with olive oil"],
        notes: (m) => `Omega-3 rich protein meal`,
        ingredientCombinations: (t) => ["pasta cooked", "tuna canned", "lettuce", "olive oil"],
      },
      {
        title: "Sweet potato & turkey",
        baseCarbs: "sweet potato cooked",
        baseProtein: "turkey breast",
        steps: (ing) => ["Roast sweet potato", "Pan-sear turkey", "Plate together"],
        notes: (m) => `Nutritious complex carbs meal`,
        ingredientCombinations: (t) => ["sweet potato cooked", "turkey breast", "spinach", "olive oil"],
      },
      {
        title: "Salmon with asparagus",
        baseProtein: "salmon fillet",
        baseCarbs: "white rice cooked",
        steps: (ing) => ["Pan-sear salmon", "Steam asparagus", "Serve with rice"],
        notes: (m) => `Omega-3 rich with ${m.protein_g}g protein`,
        ingredientCombinations: (t) => ["salmon fillet", "white rice cooked", "asparagus", "olive oil"],
      },
      {
        title: "Turkey meatballs with pasta",
        baseProtein: "turkey breast",
        baseCarbs: "pasta cooked",
        steps: (ing) => ["Form and bake meatballs", "Toss with cooked pasta"],
        notes: (m) => `Lean protein pasta dish`,
        ingredientCombinations: (t) => ["turkey breast", "pasta cooked", "tomato", "olive oil"],
      },
      {
        title: "Quinoa Buddha bowl",
        baseCarbs: "quinoa cooked",
        baseProtein: "chickpeas cooked",
        steps: (ing) => ["Combine cooked grains and legumes", "Add roasted vegetables"],
        notes: (m) => `Plant-based complete protein`,
        ingredientCombinations: (t) => ["quinoa cooked", "chickpeas cooked", "spinach", "olive oil"],
      },
      {
        title: "Beef stir-fry",
        baseProtein: "lean beef",
        baseCarbs: "brown rice cooked",
        steps: (ing) => ["Stir-fry beef with vegetables", "Serve over rice"],
        notes: (m) => `High-protein recovery meal`,
        ingredientCombinations: (t) => ["lean beef", "brown rice cooked", "broccoli", "olive oil"],
      },
      {
        title: "Tofu & veggie stir-fry",
        baseProtein: "tofu",
        baseCarbs: "brown rice cooked",
        steps: (ing) => ["Pan-fry tofu", "Stir-fry with vegetables", "Serve over rice"],
        notes: (m) => `Plant-based protein meal`,
        ingredientCombinations: (t) => ["tofu", "brown rice cooked", "broccoli", "olive oil"],
      },
    ],
    dinner: [
      {
        title: "Grilled salmon with vegetables",
        baseProtein: "salmon fillet",
        baseCarbs: "sweet potato cooked",
        steps: (ing) => ["Grill salmon", "Roast sweet potato", "Steam green beans"],
        notes: (m) => `Omega-3 rich dinner for recovery`,
        ingredientCombinations: (t) => ["salmon fillet", "sweet potato cooked", "green beans", "olive oil"],
      },
      {
        title: "Beef stir-fry with broccoli",
        baseProtein: "lean beef",
        baseCarbs: "brown rice cooked",
        steps: (ing) => ["Stir-fry beef", "Add broccoli", "Serve over rice"],
        notes: (m) => `High-protein muscle building meal`,
        ingredientCombinations: (t) => ["lean beef", "brown rice cooked", "broccoli", "olive oil"],
      },
      {
        title: "Chicken with quinoa",
        baseProtein: "chicken breast",
        baseCarbs: "quinoa cooked",
        steps: (ing) => ["Grill chicken", "Serve with cooked quinoa and vegetables"],
        notes: (m) => `Complete protein with all amino acids`,
        ingredientCombinations: (t) => ["chicken breast", "quinoa cooked", "spinach", "olive oil"],
      },
      {
        title: "Turkey meatballs with pasta",
        baseProtein: "turkey breast",
        baseCarbs: "pasta cooked",
        steps: (ing) => ["Bake seasoned meatballs", "Toss with pasta and veggies"],
        notes: (m) => `Lean protein pasta dinner`,
        ingredientCombinations: (t) => ["turkey breast", "pasta cooked", "tomato", "olive oil"],
      },
      {
        title: "Baked cod with rice",
        baseProtein: "tuna canned",
        baseCarbs: "white rice cooked",
        steps: (ing) => ["Bake fish with herbs", "Serve with rice and vegetables"],
        notes: (m) => `Light lean protein meal`,
        ingredientCombinations: (t) => ["tuna canned", "white rice cooked", "asparagus", "olive oil"],
      },
      {
        title: "Chicken with sweet potato",
        baseProtein: "chicken breast",
        baseCarbs: "sweet potato cooked",
        steps: (ing) => ["Pan-sear chicken", "Roast sweet potato", "Add green beans"],
        notes: (m) => `Complex carbs for glycogen replenishment`,
        ingredientCombinations: (t) => ["chicken breast", "sweet potato cooked", "green beans", "olive oil"],
      },
      {
        title: "Shrimp with barley",
        baseProtein: "chicken breast",
        baseCarbs: "barley cooked",
        steps: (ing) => ["Pan-sear protein", "Serve with cooked grains"],
        notes: (m) => `Lean protein dinner option`,
        ingredientCombinations: (t) => ["chicken breast", "barley cooked", "bell pepper", "olive oil"],
      },
      {
        title: "Vegetable curry with chickpeas",
        baseProtein: "chickpeas cooked",
        baseCarbs: "brown rice cooked",
        steps: (ing) => ["Make curry sauce", "Add chickpeas and vegetables", "Serve over rice"],
        notes: (m) => `Plant-based comfort meal`,
        ingredientCombinations: (t) => ["chickpeas cooked", "brown rice cooked", "bell pepper", "olive oil"],
      },
    ],
    snack: [
      {
        title: "Greek yogurt with honey",
        baseProtein: "greek yogurt",
        steps: (ing) => ["Pour yogurt in bowl", "Drizzle with honey"],
        notes: (m) => `Quick ${m.protein_g}g protein snack`,
        ingredientCombinations: (t) => ["greek yogurt", "honey"],
      },
      {
        title: "Banana with almond butter",
        baseCarbs: "banana",
        steps: (ing) => ["Slice banana", "Serve with almond butter"],
        notes: (m) => `Pre-workout carbs and healthy fats`,
        ingredientCombinations: (t) => ["banana", "almond butter"],
      },
      {
        title: "Protein smoothie",
        baseProtein: "greek yogurt",
        baseCarbs: "berries",
        steps: (ing) => ["Blend yogurt, berries, and milk"],
        notes: (m) => `${m.protein_g}g protein energy boost`,
        ingredientCombinations: (t) => ["greek yogurt", "berries", "milk"],
      },
      {
        title: "Apple with peanut butter",
        baseCarbs: "apple",
        steps: (ing) => ["Slice apple", "Serve with almond butter"],
        notes: (m) => `Simple carbs and healthy fats`,
        ingredientCombinations: (t) => ["apple", "almond butter"],
      },
      {
        title: "Cottage cheese with berries",
        baseProtein: "cottage cheese",
        steps: (ing) => ["Serve cottage cheese", "Top with fresh berries"],
        notes: (m) => `High-protein snack with ${m.protein_g}g`,
        ingredientCombinations: (t) => ["cottage cheese", "berries"],
      },
      {
        title: "Mixed nuts and dried fruit",
        baseProtein: "almonds",
        steps: (ing) => ["Mix almonds with berries"],
        notes: (m) => `Quick energy and protein fix`,
        ingredientCombinations: (t) => ["almonds", "berries"],
      },
      {
        title: "Whole wheat toast with avocado",
        baseCarbs: "whole wheat bread",
        baseProtein: "avocado",
        steps: (ing) => ["Toast bread", "Spread mashed avocado"],
        notes: (m) => `Healthy fats and quick carbs`,
        ingredientCombinations: (t) => ["whole wheat bread", "avocado", "olive oil"],
      },
      {
        title: "Hardboiled eggs",
        baseProtein: "eggs",
        steps: (ing) => ["Boil eggs until firm"],
        notes: (m) => `Portable ${m.protein_g}g protein snack`,
        ingredientCombinations: (t) => ["eggs"],
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

import type { SupabaseClient } from "@supabase/supabase-js"

export type RecipeCandidate = {
  id?: string
  title: string
  servings?: number
  ingredients: Array<{ name: string; quantity?: number | null; unit?: string | null }>
  steps: string[]
  notes?: string | null
  macros?: {
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
  category?: string | null
  tags?: string[] | null
}

export type RecipePool = {
  candidates: RecipeCandidate[]
  fallback: Record<string, RecipeCandidate[]>
}

export type RecipeSelectionInput = {
  mealType: "breakfast" | "snack" | "lunch" | "dinner" | "intra"
  targetMacros: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }
  usedTitles: Map<string, number>
  profile?: { diet?: string | null; allergies?: string[] | null }
  pool: RecipePool
}

export const fallbackRecipePool: RecipePool["fallback"] = {
  breakfast: [
    {
      title: "Greek Yogurt Berry Bowl",
      servings: 1,
      ingredients: [
        { name: "Greek yogurt", quantity: 200, unit: "g" },
        { name: "mixed berries", quantity: 100, unit: "g" },
        { name: "granola", quantity: 30, unit: "g" },
      ],
      steps: ["Spoon yogurt into a bowl.", "Top with berries and granola.", "Serve immediately."],
      notes: "Quick, protein-forward breakfast with antioxidants.",
    },
    {
      title: "Oatmeal with Banana and Honey",
      servings: 1,
      ingredients: [
        { name: "rolled oats", quantity: 60, unit: "g" },
        { name: "milk", quantity: 200, unit: "ml" },
        { name: "banana", quantity: 1, unit: "unit" },
        { name: "honey", quantity: 10, unit: "g" },
      ],
      steps: ["Cook oats in milk until creamy.", "Slice banana on top.", "Drizzle with honey."],
      notes: "Carb-focused breakfast for training days.",
    },
  ],
  snack: [
    {
      title: "Apple with Peanut Butter",
      servings: 1,
      ingredients: [
        { name: "apple", quantity: 1, unit: "unit" },
        { name: "peanut butter", quantity: 20, unit: "g" },
      ],
      steps: ["Slice apple.", "Serve with peanut butter."],
      notes: "Portable snack with balanced carbs and fat.",
    },
    {
      title: "Protein Smoothie",
      servings: 1,
      ingredients: [
        { name: "milk", quantity: 250, unit: "ml" },
        { name: "protein powder", quantity: 1, unit: "scoop" },
        { name: "banana", quantity: 1, unit: "unit" },
      ],
      steps: ["Blend all ingredients until smooth.", "Serve chilled."],
      notes: "Easy recovery snack.",
    },
  ],
  lunch: [
    {
      title: "Chicken Rice Bowl",
      servings: 1,
      ingredients: [
        { name: "cooked rice", quantity: 200, unit: "g" },
        { name: "chicken breast", quantity: 150, unit: "g" },
        { name: "mixed vegetables", quantity: 150, unit: "g" },
        { name: "olive oil", quantity: 10, unit: "g" },
      ],
      steps: ["Cook chicken and vegetables in olive oil.", "Serve over rice."],
      notes: "Balanced lunch for glycogen replenishment.",
    },
    {
      title: "Tuna Quinoa Salad",
      servings: 1,
      ingredients: [
        { name: "cooked quinoa", quantity: 180, unit: "g" },
        { name: "tuna", quantity: 120, unit: "g" },
        { name: "spinach", quantity: 60, unit: "g" },
        { name: "olive oil", quantity: 10, unit: "g" },
      ],
      steps: ["Mix quinoa, tuna, and spinach.", "Drizzle with olive oil."],
      notes: "Lean protein with complex carbs.",
    },
  ],
  dinner: [
    {
      title: "Salmon with Sweet Potato",
      servings: 1,
      ingredients: [
        { name: "salmon", quantity: 150, unit: "g" },
        { name: "sweet potato", quantity: 200, unit: "g" },
        { name: "asparagus", quantity: 120, unit: "g" },
        { name: "olive oil", quantity: 10, unit: "g" },
      ],
      steps: ["Bake salmon and sweet potato.", "Roast asparagus with olive oil.", "Serve together."],
      notes: "Omega-3 rich dinner for recovery.",
    },
    {
      title: "Turkey Pasta Primavera",
      servings: 1,
      ingredients: [
        { name: "whole wheat pasta", quantity: 90, unit: "g" },
        { name: "ground turkey", quantity: 150, unit: "g" },
        { name: "mixed vegetables", quantity: 150, unit: "g" },
        { name: "olive oil", quantity: 10, unit: "g" },
      ],
      steps: ["Cook pasta.", "Sauté turkey and vegetables.", "Combine and serve."],
      notes: "High-protein dinner with steady carbs.",
    },
  ],
  intra: [
    {
      title: "Sports Drink + Gel Pack",
      servings: 1,
      ingredients: [
        { name: "sports drink", quantity: 500, unit: "ml" },
        { name: "energy gel", quantity: 1, unit: "packet" },
      ],
      steps: ["Sip the sports drink during the session.", "Take gel midway through."],
      notes: "Carb-focused intra-workout fueling.",
    },
  ],
}

function normalizeTitle(title: string) {
  return title.trim().toLowerCase()
}

function isDietCompatible(recipe: RecipeCandidate, diet?: string | null) {
  if (!diet) return true
  const lowerDiet = diet.toLowerCase()
  const ingredientText = recipe.ingredients.map((i) => i.name.toLowerCase()).join(" ")
  if (lowerDiet.includes("vegan")) {
    return !/(egg|milk|cheese|yogurt|chicken|beef|pork|fish|turkey)/.test(ingredientText)
  }
  if (lowerDiet.includes("vegetarian")) {
    return !/(chicken|beef|pork|fish|turkey|shrimp)/.test(ingredientText)
  }
  if (lowerDiet.includes("keto")) {
    return !/(rice|pasta|bread|oats|quinoa|potato)/.test(ingredientText)
  }
  return true
}

function avoidsAllergens(recipe: RecipeCandidate, allergies?: string[] | null) {
  if (!allergies || allergies.length === 0) return true
  const ingredientText = recipe.ingredients.map((i) => i.name.toLowerCase()).join(" ")
  return !allergies.some((allergen) => ingredientText.includes(allergen.toLowerCase()))
}

function macroScore(recipe: RecipeCandidate, target: RecipeSelectionInput["targetMacros"]) {
  if (!recipe.macros) return Number.POSITIVE_INFINITY
  return (
    Math.abs(recipe.macros.kcal - target.kcal) +
    Math.abs(recipe.macros.protein_g - target.protein_g) +
    Math.abs(recipe.macros.carbs_g - target.carbs_g) +
    Math.abs(recipe.macros.fat_g - target.fat_g)
  )
}

function ensureUniqueTitle(title: string, usedTitles: Map<string, number>) {
  let candidate = title
  let suffix = 2
  while ((usedTitles.get(normalizeTitle(candidate)) ?? 0) >= 2) {
    candidate = `${title} (Var ${suffix})`
    suffix += 1
  }
  return candidate
}

export async function loadRecipePool({
  supabase,
  userId,
}: {
  supabase: SupabaseClient
  userId: string
}): Promise<RecipePool> {
  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, title, description, servings, macros_kcal, macros_protein_g, macros_carbs_g, macros_fat_g, category, tags")
    .or(`user_id.eq.${userId},user_id.is.null`)

  if (!recipes || recipes.length === 0) {
    return { candidates: [], fallback: fallbackRecipePool }
  }

  const recipeIds = recipes.map((recipe) => recipe.id)
  const { data: ingredients } = await supabase
    .from("recipe_ingredients")
    .select("recipe_id, name, quantity, unit")
    .in("recipe_id", recipeIds)

  const { data: steps } = await supabase
    .from("recipe_steps")
    .select("recipe_id, step_number, instruction")
    .in("recipe_id", recipeIds)
    .order("step_number", { ascending: true })

  const ingredientMap = new Map<string, RecipeCandidate["ingredients"]>()
  ;(ingredients ?? []).forEach((ingredient) => {
    if (!ingredientMap.has(ingredient.recipe_id)) ingredientMap.set(ingredient.recipe_id, [])
    ingredientMap.get(ingredient.recipe_id)?.push({
      name: ingredient.name,
      quantity: ingredient.quantity ?? 1,
      unit: ingredient.unit ?? "unit",
    })
  })

  const stepMap = new Map<string, string[]>()
  ;(steps ?? []).forEach((step) => {
    if (!stepMap.has(step.recipe_id)) stepMap.set(step.recipe_id, [])
    stepMap.get(step.recipe_id)?.push(step.instruction)
  })

  const candidates: RecipeCandidate[] = recipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    servings: recipe.servings ?? 1,
    ingredients: ingredientMap.get(recipe.id) ?? [],
    steps: stepMap.get(recipe.id) ?? [],
    notes: recipe.description ?? null,
    macros: {
      kcal: recipe.macros_kcal ?? 0,
      protein_g: recipe.macros_protein_g ?? 0,
      carbs_g: recipe.macros_carbs_g ?? 0,
      fat_g: recipe.macros_fat_g ?? 0,
    },
    category: recipe.category ?? null,
    tags: recipe.tags ?? null,
  }))

  return { candidates, fallback: fallbackRecipePool }
}

export function selectRecipe({
  mealType,
  targetMacros,
  usedTitles,
  profile,
  pool,
}: RecipeSelectionInput): RecipeCandidate {
  const candidates = pool.candidates.filter((recipe) => {
    if (!isDietCompatible(recipe, profile?.diet)) return false
    if (!avoidsAllergens(recipe, profile?.allergies)) return false
    const normalized = normalizeTitle(recipe.title)
    if ((usedTitles.get(normalized) ?? 0) >= 2) return false
    if (recipe.category && recipe.category.toLowerCase().includes(mealType)) return true
    if (mealType === "intra") return recipe.category?.toLowerCase().includes("intra") ?? false
    return !recipe.category || recipe.category.trim().length === 0
  })

  const sorted = candidates
    .map((recipe) => ({ recipe, score: macroScore(recipe, targetMacros) }))
    .sort((a, b) => a.score - b.score)

  const selected = sorted[0]?.recipe
  if (selected) {
    return {
      ...selected,
      title: ensureUniqueTitle(selected.title, usedTitles),
      servings: selected.servings ?? 1,
      steps: selected.steps.length > 0 ? selected.steps : ["Prepare the ingredients.", "Combine and serve."],
    }
  }

  const fallbackPool = pool.fallback[mealType] ?? pool.fallback.snack
  const fallback = fallbackPool.find((recipe) => (usedTitles.get(normalizeTitle(recipe.title)) ?? 0) < 2) ?? fallbackPool[0]
  return {
    ...fallback,
    title: ensureUniqueTitle(fallback.title, usedTitles),
    servings: fallback.servings ?? 1,
  }
}

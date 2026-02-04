"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { useGenerateRecipe } from "@/lib/hooks/useRecipe"
import type { GenerateRecipeRequest } from "@/lib/hooks/useRecipe"

interface RecipeGeneratorProps {
  onSuccess?: (recipeId: string) => void
  onError?: (error: string) => void
}

export function RecipeGenerator({ onSuccess, onError }: RecipeGeneratorProps) {
  const [mealName, setMealName] = useState("")
  const [mealType, setMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("dinner")
  const [servings, setServings] = useState("2")
  const [dietaryPrefs, setDietaryPrefs] = useState("")
  const [includeIngredients, setIncludeIngredients] = useState("")
  const [avoidIngredients, setAvoidIngredients] = useState("")
  const [cookTime, setCookTime] = useState("")
  const [proteinTarget, setProteinTarget] = useState("")
  const [calorieTarget, setCalorieTarget] = useState("")

  const generateRecipe = useGenerateRecipe()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!mealName.trim()) {
      onError?.("Please enter a meal name")
      return
    }

    const request: GenerateRecipeRequest = {
      meal_name: mealName,
      meal_type: mealType,
      servings: parseInt(servings) || 2,
      dietary_preferences: dietaryPrefs
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      ingredients_to_include: includeIngredients
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean),
      ingredients_to_avoid: avoidIngredients
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean),
      cook_time_max_min: cookTime ? parseInt(cookTime) : undefined,
      target_macros: {
        protein_g: proteinTarget ? parseInt(proteinTarget) : undefined,
        kcal: calorieTarget ? parseInt(calorieTarget) : undefined,
      },
    }

    try {
      const result = await generateRecipe.mutateAsync(request)
      onSuccess?.(result.recipe.id)
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to generate recipe")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold mb-2">Generate Recipe</h2>
        <p className="text-sm text-muted-foreground">
          Describe what you want to cook and we'll generate a detailed recipe with ingredients and steps.
        </p>
      </div>

      {/* Meal Name */}
      <div className="space-y-2">
        <label htmlFor="meal_name" className="block text-sm font-medium">
          Meal Name *
        </label>
        <input
          id="meal_name"
          type="text"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
          placeholder="e.g., Grilled Salmon with Asparagus"
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      {/* Meal Type */}
      <div className="space-y-2">
        <label htmlFor="meal_type" className="block text-sm font-medium">
          Meal Type *
        </label>
        <select
          id="meal_type"
          value={mealType}
          onChange={(e) => setMealType(e.target.value as any)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
      </div>

      {/* Servings */}
      <div className="space-y-2">
        <label htmlFor="servings" className="block text-sm font-medium">
          Base Servings
        </label>
        <input
          id="servings"
          type="number"
          min="1"
          value={servings}
          onChange={(e) => setServings(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Include Ingredients */}
      <div className="space-y-2">
        <label htmlFor="include_ingredients" className="block text-sm font-medium">
          Include Ingredients
        </label>
        <textarea
          id="include_ingredients"
          value={includeIngredients}
          onChange={(e) => setIncludeIngredients(e.target.value)}
          placeholder="e.g., salmon, broccoli, garlic (comma-separated)"
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary h-20 resize-none"
        />
      </div>

      {/* Avoid Ingredients */}
      <div className="space-y-2">
        <label htmlFor="avoid_ingredients" className="block text-sm font-medium">
          Avoid Ingredients
        </label>
        <textarea
          id="avoid_ingredients"
          value={avoidIngredients}
          onChange={(e) => setAvoidIngredients(e.target.value)}
          placeholder="e.g., dairy, nuts, gluten (comma-separated)"
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary h-20 resize-none"
        />
      </div>

      {/* Dietary Preferences */}
      <div className="space-y-2">
        <label htmlFor="dietary_prefs" className="block text-sm font-medium">
          Dietary Preferences
        </label>
        <textarea
          id="dietary_prefs"
          value={dietaryPrefs}
          onChange={(e) => setDietaryPrefs(e.target.value)}
          placeholder="e.g., high-protein, low-carb, vegan (comma-separated)"
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary h-20 resize-none"
        />
      </div>

      {/* Cooking Time */}
      <div className="space-y-2">
        <label htmlFor="cook_time" className="block text-sm font-medium">
          Max Cooking Time (minutes)
        </label>
        <input
          id="cook_time"
          type="number"
          min="0"
          value={cookTime}
          onChange={(e) => setCookTime(e.target.value)}
          placeholder="e.g., 30"
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Macro Targets */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="protein_target" className="block text-sm font-medium">
            Protein Target (g)
          </label>
          <input
            id="protein_target"
            type="number"
            min="0"
            value={proteinTarget}
            onChange={(e) => setProteinTarget(e.target.value)}
            placeholder="e.g., 40"
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="calorie_target" className="block text-sm font-medium">
            Calorie Target
          </label>
          <input
            id="calorie_target"
            type="number"
            min="0"
            value={calorieTarget}
            onChange={(e) => setCalorieTarget(e.target.value)}
            placeholder="e.g., 500"
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={generateRecipe.isPending || !mealName.trim()}
        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {generateRecipe.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {generateRecipe.isPending ? "Generating..." : "Generate Recipe"}
      </button>

      {generateRecipe.error && (
        <div className="p-3 rounded bg-red-50 text-red-600 text-sm">
          {generateRecipe.error.message}
        </div>
      )}
    </form>
  )
}

"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"

export interface RecipeIngredient {
  id?: string
  name: string
  quantity: number
  unit: string
  category: string
  optional: boolean
}

export interface RecipeStep {
  id?: string
  step_number: number
  instruction: string
  timer_seconds?: number | null
}

export interface Recipe {
  id: string
  title: string
  description?: string
  servings: number
  cook_time_min?: number
  macros_kcal: number
  macros_protein_g: number
  macros_carbs_g: number
  macros_fat_g: number
  tags?: string[]
  category?: string
  ingredients?: RecipeIngredient[]
  steps?: RecipeStep[]
  scaling_factor?: number
}

export interface GenerateRecipeRequest {
  meal_name: string
  meal_type: "breakfast" | "lunch" | "dinner" | "snack"
  servings?: number
  dietary_preferences?: string[]
  ingredients_to_include?: string[]
  ingredients_to_avoid?: string[]
  cook_time_max_min?: number
  target_macros?: {
    kcal?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
  }
}

/**
 * Hook to generate a recipe with IA
 */
export function useGenerateRecipe() {
  return useMutation({
    mutationFn: async (request: GenerateRecipeRequest) => {
      const response = await fetch("/api/ai/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate recipe")
      }

      return response.json() as Promise<{ ok: boolean; recipe: Recipe }>
    },
  })
}

/**
 * Hook to fetch a recipe with optional scaling
 */
export function useRecipe(recipeId: string | null, servings?: number) {
  return useQuery({
    queryKey: ["recipe", recipeId, servings],
    queryFn: async () => {
      if (!recipeId) return null

      const params = new URLSearchParams()
      if (servings) params.append("servings", String(servings))

      const response = await fetch(`/api/ai/recipes/${recipeId}?${params}`, {
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch recipe")
      }

      return response.json() as Promise<{
        ok: boolean
        recipe: Recipe
        ingredients: RecipeIngredient[]
        steps: RecipeStep[]
        scaling_factor: number
      }>
    },
    enabled: !!recipeId,
  })
}

/**
 * Hook to scale recipe ingredients
 */
export function useScaleRecipe() {
  return useMutation({
    mutationFn: async ({ recipeId, newServings }: { recipeId: string; newServings: number }) => {
      const response = await fetch("/api/ai/recipes/scale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_id: recipeId,
          new_servings: newServings,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to scale recipe")
      }

      return response.json() as Promise<{
        ok: boolean
        recipe: Recipe
        ingredients: RecipeIngredient[]
        scaling_factor: number
      }>
    },
  })
}

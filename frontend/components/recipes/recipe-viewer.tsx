"use client"

import { useState } from "react"
import { ChevronDown, Clock, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRecipe } from "@/lib/hooks/useRecipe"
import { formatQuantity } from "@/lib/recipes/scale"
import type { RecipeIngredient, RecipeStep } from "@/lib/hooks/useRecipe"

interface RecipeViewerProps {
  recipeId: string
  onClose?: () => void
}

export function RecipeViewer({ recipeId, onClose }: RecipeViewerProps) {
  const [servings, setServings] = useState(1)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]))

  const { data, isLoading, error } = useRecipe(recipeId, servings)

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-6 bg-muted rounded animate-pulse" />
        <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center text-red-600">
        Failed to load recipe
      </div>
    )
  }

  const { recipe, ingredients, steps } = data

  const toggleStep = (index: number) => {
    const next = new Set(expandedSteps)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    setExpandedSteps(next)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">{recipe.title}</h2>
        {recipe.description && (
          <p className="text-sm text-muted-foreground">{recipe.description}</p>
        )}
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap gap-4 text-sm">
        {recipe.cook_time_min && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{recipe.cook_time_min} min</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="w-4 h-4" />
          <div className="flex items-center gap-2">
            <span>{servings} servings</span>
            <select
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="bg-background border border-border rounded px-2 py-1 text-xs font-medium"
            >
              {[1, 2, 3, 4, 6, 8, 12].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Macros */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-muted p-3 rounded">
          <div className="text-xs font-medium text-muted-foreground mb-1">Calories</div>
          <div className="text-lg font-bold text-foreground">
            {recipe.macros_kcal}
            <span className="text-xs ml-1">kcal</span>
          </div>
        </div>
        <div className="bg-muted p-3 rounded">
          <div className="text-xs font-medium text-muted-foreground mb-1">Protein</div>
          <div className="text-lg font-bold text-foreground">
            {recipe.macros_protein_g}
            <span className="text-xs ml-1">g</span>
          </div>
        </div>
        <div className="bg-muted p-3 rounded">
          <div className="text-xs font-medium text-muted-foreground mb-1">Carbs</div>
          <div className="text-lg font-bold text-foreground">
            {recipe.macros_carbs_g}
            <span className="text-xs ml-1">g</span>
          </div>
        </div>
        <div className="bg-muted p-3 rounded">
          <div className="text-xs font-medium text-muted-foreground mb-1">Fat</div>
          <div className="text-lg font-bold text-foreground">
            {recipe.macros_fat_g}
            <span className="text-xs ml-1">g</span>
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <h3 className="font-semibold text-foreground mb-3">Ingredients</h3>
        <div className="space-y-2">
          {ingredients.map((ingredient: RecipeIngredient, index) => (
            <div
              key={ingredient.id || index}
              className={cn(
                "flex items-start gap-3 p-2 rounded text-sm",
                ingredient.optional ? "text-muted-foreground/70" : "text-foreground"
              )}
            >
              <div className="flex-1">
                <div className="font-medium">
                  {formatQuantity(ingredient.quantity)} {ingredient.unit}
                </div>
                <div>{ingredient.name}</div>
                {ingredient.optional && (
                  <div className="text-xs text-muted-foreground italic">(optional)</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      {steps && steps.length > 0 && (
        <div>
          <h3 className="font-semibold text-foreground mb-3">Instructions</h3>
          <div className="space-y-2">
            {steps.map((step: RecipeStep, index) => (
              <button
                key={step.id || index}
                onClick={() => toggleStep(index)}
                className={cn(
                  "w-full text-left p-3 rounded border border-border transition-colors",
                  expandedSteps.has(index)
                    ? "bg-muted border-border"
                    : "hover:bg-muted/50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                      {step.step_number}
                    </div>
                    <div className="flex-1">
                      {expandedSteps.has(index) && (
                        <p className="text-sm text-foreground mb-2">
                          {step.instruction}
                        </p>
                      )}
                      {!expandedSteps.has(index) && (
                        <p className="text-sm text-foreground line-clamp-2">
                          {step.instruction}
                        </p>
                      )}
                      {step.timer_seconds && (
                        <div className="text-xs text-muted-foreground mt-1">
                          ⏱️ {Math.round(step.timer_seconds / 60)} min
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 flex-shrink-0 transition-transform",
                      expandedSteps.has(index) ? "rotate-180" : ""
                    )}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      {onClose && (
        <div className="flex gap-2 pt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded border border-border hover:bg-muted transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}

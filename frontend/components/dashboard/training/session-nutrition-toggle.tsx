"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Flame } from "lucide-react"
import type { MealPlanItem, NutritionMacros } from "@/lib/db/types"

interface SessionNutritionToggleProps {
  sessionId: string
  date: string
  meals?: MealPlanItem[]
  target?: NutritionMacros | null
  isLoading?: boolean
}

export function SessionNutritionToggle({
  sessionId,
  date,
  meals = [],
  target,
  isLoading = false,
}: SessionNutritionToggleProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const relevantMeals = meals.filter((meal) => {
    if (!meal.time) return false
    // Extract time from meal to see if it's relevant to this session
    // For now, show meals within a reasonable window
    return true
  })

  if (isLoading || relevantMeals.length === 0) {
    return null
  }

  const totalMacros = relevantMeals.reduce(
    (acc, meal) => ({
      kcal: acc.kcal + (meal.kcal || 0),
      protein_g: acc.protein_g + (meal.protein_g || 0),
      carbs_g: acc.carbs_g + (meal.carbs_g || 0),
      fat_g: acc.fat_g + (meal.fat_g || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )

  return (
    <div className="pt-3 border-t border-border/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-2 px-0 py-2 text-sm font-medium text-foreground hover:bg-muted/50 rounded transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>🍽️ Nutrition</span>
          <span className="text-xs text-muted-foreground">({relevantMeals.length} meals)</span>
        </div>
        <ChevronDown
          className="h-4 w-4 transition-transform"
          style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3 pt-3 border-t border-border/50">
          {/* Macro Summary */}
          {target && (
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-xs text-muted-foreground mb-1">Cal</div>
                <div className="text-xs font-semibold text-foreground">{totalMacros.kcal}</div>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-xs text-muted-foreground mb-1">Pro</div>
                <div className="text-xs font-semibold text-foreground">{totalMacros.protein_g}g</div>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-xs text-muted-foreground mb-1">Carb</div>
                <div className="text-xs font-semibold text-foreground">{totalMacros.carbs_g}g</div>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-xs text-muted-foreground mb-1">Fat</div>
                <div className="text-xs font-semibold text-foreground">{totalMacros.fat_g}g</div>
              </div>
            </div>
          )}

          {/* Meals List */}
          <div className="space-y-2">
            {relevantMeals.map((meal) => (
              <div key={meal.id} className="bg-muted/50 rounded p-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">{meal.name}</div>
                    {meal.time && (
                      <div className="text-muted-foreground text-[0.7rem]">@{meal.time}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-foreground font-semibold whitespace-nowrap">
                    <Flame className="h-3 w-3" />
                    {meal.kcal}
                  </div>
                </div>
                {(meal.protein_g || meal.carbs_g || meal.fat_g) && (
                  <div className="text-muted-foreground text-[0.65rem] mt-1">
                    P: {meal.protein_g || 0}g | C: {meal.carbs_g || 0}g | F: {meal.fat_g || 0}g
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { Badge } from "@/components/ui/badge"
import type { PlanWeekMeal } from "@/lib/db/types"

interface MealRowProps {
  meal: PlanWeekMeal
  onSelect: (meal: PlanWeekMeal) => void
}

export function MealRow({ meal, onSelect }: MealRowProps) {
  const emoji = meal.emoji ?? (meal.recipe?.title ? "🍽️" : "🥗")
  const timeLabel = meal.time ? `Time: ${meal.time}` : "Any time"

  return (
    <button
      type="button"
      onClick={() => onSelect(meal)}
      className="w-full text-left rounded-lg border border-border/40 bg-background px-3 py-2 hover:bg-muted/30 transition"
    >
      <div className="flex items-center gap-2">
        <span className="text-base">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{meal.recipe?.title ?? meal.name}</p>
          <p className="text-[11px] text-muted-foreground">{timeLabel}</p>
        </div>
        <span className="text-[11px] text-muted-foreground">{meal.kcal} kcal</span>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        <Badge variant="secondary" className="text-[10px]">P {meal.protein_g}g</Badge>
        <Badge variant="secondary" className="text-[10px]">C {meal.carbs_g}g</Badge>
        <Badge variant="secondary" className="text-[10px]">F {meal.fat_g}g</Badge>
      </div>
    </button>
  )
}

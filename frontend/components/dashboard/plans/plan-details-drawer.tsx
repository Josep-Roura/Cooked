"use client"

import { format } from "date-fns"
import { Checkbox } from "@/components/ui/checkbox"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import type { PlanWeekMeal } from "@/lib/db/types"

interface PlanDetailsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedMeal: PlanWeekMeal | null
  selectedDay: Date | null
  dayMeals: PlanWeekMeal[]
}

export function PlanDetailsDrawer({
  open,
  onOpenChange,
  selectedMeal,
  selectedDay,
  dayMeals,
}: PlanDetailsDrawerProps) {
  const title = selectedMeal
    ? selectedMeal.recipe?.title ?? selectedMeal.name
    : selectedDay
      ? `Meals for ${format(selectedDay, "EEE, MMM d")}`
      : "Plan details"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="space-y-4">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        {selectedMeal ? (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{selectedMeal.kcal} kcal</Badge>
              <Badge variant="secondary">P {selectedMeal.protein_g}g</Badge>
              <Badge variant="secondary">C {selectedMeal.carbs_g}g</Badge>
              <Badge variant="secondary">F {selectedMeal.fat_g}g</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Time: Any time</p>
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Ingredients</p>
              {selectedMeal.recipe_ingredients.length > 0 ? (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {selectedMeal.recipe_ingredients.map((ingredient) => (
                    <li key={ingredient.id}>
                      {ingredient.name}
                      {ingredient.quantity ? ` · ${ingredient.quantity}` : ""}
                      {ingredient.unit ? ` ${ingredient.unit}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No ingredients listed.</p>
              )}
            </div>
            {selectedMeal.recipe?.description && (
              <p className="text-xs text-muted-foreground">{selectedMeal.recipe.description}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={false} disabled />
              Mark eaten (view only)
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {dayMeals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meals planned for this day.</p>
            ) : (
              dayMeals.map((meal) => (
                <div key={meal.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{meal.recipe?.title ?? meal.name}</p>
                      <p className="text-xs text-muted-foreground">Any time</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{meal.kcal} kcal</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="secondary" className="text-[10px]">P {meal.protein_g}g</Badge>
                    <Badge variant="secondary" className="text-[10px]">C {meal.carbs_g}g</Badge>
                    <Badge variant="secondary" className="text-[10px]">F {meal.fat_g}g</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

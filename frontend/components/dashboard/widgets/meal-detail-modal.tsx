"use client"

import { useMemo } from "react"
import { NotionModal } from "@/components/ui/notion-modal"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useRecipe } from "@/lib/db/hooks"
import { useSession } from "@/hooks/use-session"
import type { MealPlanItem, MealPlanIngredient } from "@/lib/db/types"

interface MealDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  meal: MealPlanItem | null
}

export function MealDetailModal({ open, onOpenChange, meal }: MealDetailModalProps) {
  const { user } = useSession()
  const recipeQuery = useRecipe(user?.id, open ? meal?.recipe_id ?? null : null)

  const ingredients = useMemo(() => {
    if (!meal) return []
    if (recipeQuery.data?.ingredients?.length) {
      return recipeQuery.data.ingredients.map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      }))
    }
    return (meal.ingredients ?? []).map((ingredient: MealPlanIngredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: null,
    }))
  }, [meal, recipeQuery.data?.ingredients])

  if (!meal) {
    return (
      <NotionModal open={open} onOpenChange={onOpenChange} title="Meal details">
        <p className="text-sm text-muted-foreground">Select a meal to see details.</p>
      </NotionModal>
    )
  }

  return (
    <NotionModal
      open={open}
      onOpenChange={onOpenChange}
      title={meal.name}
      description={meal.time ? `Planned for ${meal.time}` : "Meal time flexible"}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{meal.kcal} kcal</Badge>
          <Badge variant="secondary">P {meal.protein_g}g</Badge>
          <Badge variant="secondary">C {meal.carbs_g}g</Badge>
          <Badge variant="secondary">F {meal.fat_g}g</Badge>
        </div>

        {meal.notes ? (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
            {meal.notes}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Ingredients</h3>
            {recipeQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : ingredients.length > 0 ? (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {ingredients.map((ingredient) => (
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
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Recipe steps</h3>
            {recipeQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : recipeQuery.data?.steps?.length ? (
              <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
                {recipeQuery.data.steps.map((step) => (
                  <li key={step.id}>{step.instruction}</li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted-foreground">No steps provided.</p>
            )}
          </div>
        </div>
      </div>
    </NotionModal>
  )
}

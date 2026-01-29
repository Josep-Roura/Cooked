"use client"

import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { NotionModal } from "@/components/ui/notion-modal"
import { Skeleton } from "@/components/ui/skeleton"
import { useRecipe } from "@/lib/db/hooks"
import type { PlanWeekMeal } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"

interface PlanDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  meal: PlanWeekMeal | null
}

export function PlanDetailsModal({ open, onOpenChange, meal }: PlanDetailsModalProps) {
  const { user } = useSession()
  const recipeQuery = useRecipe(user?.id, open ? meal?.recipe_id ?? null : null)

  if (!meal) {
    return (
      <NotionModal open={open} onOpenChange={onOpenChange} title="Meal details">
        <p className="text-sm text-muted-foreground">Select a meal to see details.</p>
      </NotionModal>
    )
  }

  const title = meal.recipe?.title ?? meal.name
  const description = meal.time ? `Planned for ${meal.time}` : "Meal time flexible"
  const ingredients = recipeQuery.data?.ingredients ?? meal.recipe_ingredients ?? []
  const steps = recipeQuery.data?.steps ?? []

  return (
    <NotionModal open={open} onOpenChange={onOpenChange} title={title} description={description}>
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
                    {"quantity" in ingredient && ingredient.quantity ? ` · ${ingredient.quantity}` : ""}
                    {"unit" in ingredient && ingredient.unit ? ` ${ingredient.unit}` : ""}
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
            ) : steps.length > 0 ? (
              <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
                {steps.map((step) => (
                  <li key={step.id}>{step.instruction}</li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted-foreground">
                {meal.recipe?.description ?? "No steps provided."}
              </p>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Planned for {format(new Date(meal.date), "EEEE, MMM d")}
        </div>
      </div>
    </NotionModal>
  )
}

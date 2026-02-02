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
  const description = meal.time ? `Planned for ${meal.time} · Duration: 60 min` : "Meal time flexible · Duration: 60 min"
  const ingredients = recipeQuery.data?.ingredients ?? meal.recipe_ingredients ?? []
  const steps = recipeQuery.data?.steps ?? []

  return (
    <NotionModal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="space-y-6">
        <div className="bg-muted/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Nutrition Information</h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">{meal.kcal}</div>
              <div className="text-xs text-muted-foreground">kcal</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{meal.protein_g}g</div>
              <div className="text-xs text-muted-foreground">Protein</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-600">{meal.carbs_g}g</div>
              <div className="text-xs text-muted-foreground">Carbs</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-600">{meal.fat_g}g</div>
              <div className="text-xs text-muted-foreground">Fat</div>
            </div>
          </div>
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

"use client"

import { useState } from "react"
import { Lock, Utensils } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { MealDetailModal } from "@/components/dashboard/widgets/meal-detail-modal"
import type { MealPlanDay, MealPlanIngredient, MealPlanItem } from "@/lib/db/types"

interface PlanCardProps {
  date: string
  plan: MealPlanDay | null
  isLoading: boolean
  isUpdating: boolean
  highlightUnchecked?: boolean
  onToggleMeal: (itemId: string, eaten: boolean) => void
  onToggleIngredient: (ingredientId: string, checked: boolean) => void
}

function formatMealMacros(meal: MealPlanItem) {
  return [
    { label: "kcal", value: meal.kcal },
    { label: "P", value: meal.protein_g },
    { label: "C", value: meal.carbs_g },
    { label: "F", value: meal.fat_g },
  ]
}

function resolveMealEmoji(meal: MealPlanItem) {
  if (meal.emoji) return meal.emoji
  const type = meal.meal_type?.toLowerCase() ?? ""
  if (type.includes("breakfast")) return "🍳"
  if (type.includes("lunch")) return "🥗"
  if (type.includes("dinner")) return "🍝"
  if (type.includes("snack")) return "🍪"
  if (type.includes("pre")) return "⚡"
  if (type.includes("post")) return "💪"
  return "🥙"
}

export function PlanCard({
  date,
  plan,
  isLoading,
  isUpdating,
  highlightUnchecked = false,
  onToggleMeal,
  onToggleIngredient,
}: PlanCardProps) {
  const [selectedMeal, setSelectedMeal] = useState<MealPlanItem | null>(null)

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  const dateLabel = format(parseISO(date), "EEEE, MMM d")

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Daily meal plan</h3>
        <span className="text-xs text-muted-foreground">{dateLabel}</span>
      </div>

      {plan && plan.items.length > 0 ? (
        <div className="space-y-3">
          {plan.items.map((meal) => {
            const checkboxId = `meal-${date}-${meal.slot}`
            const ingredients = (meal.ingredients ?? []).map((ingredient, index) => {
              if (typeof ingredient === "string") {
                return {
                  id: `${meal.id}-ingredient-${index}`,
                  meal_item_id: meal.id,
                  name: ingredient,
                  quantity: null,
                  checked: false,
                }
              }
              return {
                id: ingredient.id ?? `${meal.id}-ingredient-${index}`,
                meal_item_id: ingredient.meal_item_id ?? meal.id,
                name: ingredient.name,
                quantity: ingredient.quantity ?? null,
                checked: ingredient.checked ?? false,
                _missingId: !ingredient.id,
              }
            })
            return (
              <div
                key={meal.slot}
                className={`border border-border rounded-xl px-4 py-3 flex items-start gap-3 ${
                  highlightUnchecked && !meal.eaten ? "ring-2 ring-primary/30" : ""
                }`}
              >
                <div className="flex flex-col items-start gap-2 pt-1">
                  <Checkbox
                    id={checkboxId}
                    checked={meal.eaten}
                    onCheckedChange={(checked) => onToggleMeal(meal.id, Boolean(checked))}
                    disabled={isUpdating}
                  />
                  <label htmlFor={checkboxId} className="text-xs text-muted-foreground">
                    I ate this
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMeal(meal)}
                  className="flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {resolveMealEmoji(meal)} {meal.name}
                    </p>
                    {meal.locked && (
                      <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        Locked
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{meal.time ?? "Any time"}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formatMealMacros(meal).map((macro) => (
                      <Badge key={macro.label} variant="secondary" className="text-[10px]">
                        {macro.value}
                        {macro.label === "kcal" ? " kcal" : `${macro.label}g`}
                      </Badge>
                    ))}
                  </div>
                </button>
                {ingredients.length > 0 && (
                  <div className="hidden md:flex flex-col gap-2 text-xs text-muted-foreground">
                    {ingredients.slice(0, 3).map((ingredient: MealPlanIngredient & { _missingId?: boolean }) => (
                      <div key={ingredient.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`ingredient-${ingredient.id}`}
                          checked={ingredient.checked}
                          onCheckedChange={(checked) =>
                            ingredient._missingId ? null : onToggleIngredient(ingredient.id, Boolean(checked))
                          }
                          disabled={isUpdating || ingredient._missingId}
                        />
                        <label htmlFor={`ingredient-${ingredient.id}`}>
                          {ingredient.name}
                          {ingredient.quantity ? ` · ${ingredient.quantity}` : ""}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-muted rounded-xl p-4">
          <EmptyState
            icon={Utensils}
            title="No plan for this day"
            description="Your daily meal plan will appear here once it's generated."
          />
        </div>
      )}

      <MealDetailModal open={Boolean(selectedMeal)} onOpenChange={(open) => !open && setSelectedMeal(null)} meal={selectedMeal} />
    </div>
  )
}

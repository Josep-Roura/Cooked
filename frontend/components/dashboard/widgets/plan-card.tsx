"use client"

import { useMemo, useState } from "react"
import { Lock, Utensils } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { NotionModal } from "@/components/ui/notion-modal"
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

function buildMealEmoji(meal: MealPlanItem) {
  if (meal.emoji) return meal.emoji
  const typeSource = `${meal.meal_type ?? ""} ${meal.name ?? ""}`.toLowerCase()
  if (typeSource.includes("breakfast")) return "🥣"
  if (typeSource.includes("lunch")) return "🥗"
  if (typeSource.includes("dinner")) return "🍲"
  if (typeSource.includes("snack")) return "🍎"
  if (typeSource.includes("pre")) return "⚡️"
  if (typeSource.includes("post")) return "🍽️"
  if (typeSource.includes("coffee")) return "☕️"
  if (typeSource.includes("smoothie")) return "🥤"
  const hour = meal.time ? Number(meal.time.split(":")[0]) : null
  if (hour !== null) {
    if (hour < 10) return "🥞"
    if (hour < 14) return "🥪"
    if (hour < 18) return "🍱"
    return "🍝"
  }
  return "🍽️"
}

function normalizeIngredients(meal: MealPlanItem) {
  return (meal.ingredients ?? []).map((ingredient, index) => {
    if (typeof ingredient === "string") {
      return {
        id: `${meal.id}-ingredient-${index}`,
        meal_item_id: meal.id,
        name: ingredient,
        quantity: null,
        checked: false,
        _missingId: true,
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
  const dateLabel = format(parseISO(date), "EEEE, MMM d")
  const selectedIngredients = useMemo(
    () => (selectedMeal ? normalizeIngredients(selectedMeal) : []),
    [selectedMeal],
  )
  const instructionText =
    selectedMeal?.notes?.trim() ||
    "Prep the ingredients, cook or assemble, and plate to match your nutrition plan."

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

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
            const emoji = buildMealEmoji(meal)

            return (
              <div
                key={meal.slot}
                className={`border border-border rounded-xl px-4 py-3 flex items-start gap-3 bg-background ${
                  highlightUnchecked && !meal.eaten ? "ring-2 ring-primary/30" : ""
                }`}
              >
                <div className="flex flex-col items-start gap-2 pt-1">
                  <Checkbox
                    id={checkboxId}
                    checked={meal.eaten}
                    onCheckedChange={(checked) => onToggleMeal(meal.id, Boolean(checked))}
                    disabled={isUpdating}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <label htmlFor={checkboxId} className="text-[10px] text-muted-foreground">
                    I ate this
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMeal(meal)}
                  className="flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xl">{emoji}</span>
                    <p className="text-sm font-semibold text-foreground">{meal.name}</p>
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

      <NotionModal
        open={Boolean(selectedMeal)}
        onOpenChange={(open) => (!open ? setSelectedMeal(null) : null)}
        title={selectedMeal ? `${buildMealEmoji(selectedMeal)} ${selectedMeal.name}` : ""}
        description={selectedMeal?.time ? `Scheduled for ${selectedMeal.time}` : "Meal details"}
      >
        {selectedMeal ? (
          <div className="space-y-6 text-sm text-muted-foreground">
            <div>
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Macros</h4>
              <div className="flex flex-wrap gap-2">
                {formatMealMacros(selectedMeal).map((macro) => (
                  <Badge key={macro.label} variant="secondary" className="text-xs">
                    {macro.value}
                    {macro.label === "kcal" ? " kcal" : `${macro.label}g`}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Ingredients</h4>
              {selectedIngredients.length > 0 ? (
                <ul className="space-y-2">
                  {selectedIngredients.map((ingredient: MealPlanIngredient & { _missingId?: boolean }) => (
                    <li key={ingredient.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`ingredient-${ingredient.id}`}
                        checked={ingredient.checked}
                        onCheckedChange={(checked) =>
                          ingredient._missingId ? null : onToggleIngredient(ingredient.id, Boolean(checked))
                        }
                        disabled={isUpdating || ingredient._missingId}
                      />
                      <label htmlFor={`ingredient-${ingredient.id}`} className="text-sm text-muted-foreground">
                        {ingredient.name}
                        {ingredient.quantity ? ` · ${ingredient.quantity}` : ""}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No ingredients listed yet.</p>
              )}
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Instructions</h4>
              <p className="text-sm text-muted-foreground">
                {instructionText}
              </p>
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Notes</h4>
              <p className="text-sm text-muted-foreground">
                {selectedMeal.notes ? "See instructions for details." : "No additional notes."}
              </p>
            </div>
          </div>
        ) : null}
      </NotionModal>
    </div>
  )
}

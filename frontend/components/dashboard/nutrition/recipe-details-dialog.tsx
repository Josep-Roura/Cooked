"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NotionModal } from "@/components/ui/notion-modal"
import type { MealPlanItem } from "@/lib/db/types"

interface RecipeDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  meal: MealPlanItem | null
  emoji: string
  onCopyIngredients: () => void
}

export function RecipeDetailsDialog({
  open,
  onOpenChange,
  meal,
  emoji,
  onCopyIngredients,
}: RecipeDetailsDialogProps) {
  if (!meal) {
    return (
      <NotionModal open={open} onOpenChange={onOpenChange} title="Recipe details">
        <p className="text-sm text-muted-foreground">Select a meal to view details.</p>
      </NotionModal>
    )
  }

  const recipe = meal.recipe && typeof meal.recipe === "object" ? meal.recipe : null
  const recipeTitle =
    recipe && "title" in recipe ? String((recipe as { title?: unknown }).title ?? "") : ""
  const recipeServings =
    recipe && "servings" in recipe ? Number((recipe as { servings?: unknown }).servings ?? 0) : 0
  const recipeIngredients =
    recipe && "ingredients" in recipe && Array.isArray((recipe as { ingredients?: unknown }).ingredients)
      ? ((recipe as { ingredients: Array<{ name?: unknown; quantity?: unknown; unit?: unknown }> }).ingredients ?? []).map(
          (ingredient) => ({
            name: String(ingredient.name ?? ""),
            quantity: ingredient.quantity ?? null,
            unit: ingredient.unit ?? null,
          }),
        )
      : []
  const recipeSteps =
    recipe && "steps" in recipe && Array.isArray((recipe as { steps?: unknown }).steps)
      ? ((recipe as { steps: string[] }).steps ?? []).filter(Boolean)
      : []
  const recipeNotes =
    recipe && "notes" in recipe ? String((recipe as { notes?: unknown }).notes ?? "") : ""

  const ingredients = recipeIngredients.length
    ? recipeIngredients
    : (meal.ingredients ?? []).map((ingredient) => {
        if (typeof ingredient === "string") {
          return { name: ingredient, quantity: null, unit: null }
        }
        return {
          name: ingredient.name,
          quantity: ingredient.quantity ?? null,
          unit: ingredient.unit ?? null,
        }
      })

  return (
    <NotionModal
      open={open}
      onOpenChange={onOpenChange}
      title={`${emoji} ${meal.name}`}
      description={meal.time ? `Scheduled for ${meal.time}` : "Recipe details"}
    >
      <div className="space-y-6 text-sm text-muted-foreground">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{meal.kcal} kcal</Badge>
          <Badge variant="secondary">P {meal.protein_g}g</Badge>
          <Badge variant="secondary">C {meal.carbs_g}g</Badge>
          <Badge variant="secondary">F {meal.fat_g}g</Badge>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Recipe</h4>
          {recipeTitle ? (
            <div className="space-y-2">
              <p className="text-sm text-foreground font-medium">{recipeTitle}</p>
              {recipeServings > 0 && <p className="text-xs text-muted-foreground">Servings: {recipeServings}</p>}
            </div>
          ) : (
            <p>No recipe title provided.</p>
          )}
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Ingredients</h4>
          {ingredients.length ? (
            <ul className="space-y-1">
              {ingredients.map((ingredient, index) => (
                <li key={`${ingredient.name}-${index}`}>
                  {ingredient.name}
                  {ingredient.quantity ? ` · ${ingredient.quantity}` : ""}
                  {ingredient.unit ? ` ${ingredient.unit}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p>No ingredients listed yet.</p>
          )}
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Steps</h4>
          {recipeSteps.length ? (
            <ol className="space-y-1 list-decimal list-inside">
              {recipeSteps.map((step, index) => (
                <li key={`${step}-${index}`}>{step}</li>
              ))}
            </ol>
          ) : (
            <p>{(meal.notes ?? recipeNotes) || "Prepare, cook, and plate to match your nutrition plan."}</p>
          )}
          {recipeNotes ? <p className="text-xs text-muted-foreground mt-2">Notes: {recipeNotes}</p> : null}
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Tips</h4>
          <p>Swap proteins or carbs to match your preference while keeping macros aligned.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="rounded-full text-xs" onClick={onCopyIngredients}>
            Add ingredients to shopping list
          </Button>
        </div>
      </div>
    </NotionModal>
  )
}

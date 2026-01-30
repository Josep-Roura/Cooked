"use client"

import { useMemo } from "react"
import { Clipboard, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"
import type { MealPlanItem } from "@/lib/db/types"

interface RecipeDetailsDialogProps {
  meal: MealPlanItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdaptMeal: (meal: MealPlanItem) => void
  emoji: string
}

type IngredientItem = {
  name: string
  quantity?: string
}

function normalizeIngredients(input: MealPlanItem["ingredients"]) {
  if (!Array.isArray(input)) return [] as IngredientItem[]
  return input
    .map((item) => {
      if (typeof item === "string") {
        return { name: item }
      }
      if (item && typeof item === "object") {
        const record = item as { name?: string; quantity?: string; amount?: string }
        return { name: record.name ?? "Ingredient", quantity: record.quantity ?? record.amount ?? undefined }
      }
      return null
    })
    .filter((item): item is IngredientItem => Boolean(item?.name))
}

function normalizeRecipe(recipe: MealPlanItem["recipe"]) {
  if (!recipe || typeof recipe !== "object") {
    return { steps: [], tips: [], substitutions: [] } as {
      steps: string[]
      tips: string[]
      substitutions: string[]
    }
  }
  const record = recipe as { steps?: unknown; tips?: unknown; substitutions?: unknown }
  const steps = Array.isArray(record.steps) ? record.steps.filter((step) => typeof step === "string") : []
  const tips = Array.isArray(record.tips) ? record.tips.filter((tip) => typeof tip === "string") : []
  const substitutions = Array.isArray(record.substitutions)
    ? record.substitutions.filter((tip) => typeof tip === "string")
    : []
  return { steps, tips, substitutions }
}

export function RecipeDetailsDialog({ meal, open, onOpenChange, onAdaptMeal, emoji }: RecipeDetailsDialogProps) {
  const { toast } = useToast()
  const ingredients = useMemo(() => normalizeIngredients(meal?.ingredients), [meal?.ingredients])
  const recipe = useMemo(() => normalizeRecipe(meal?.recipe), [meal?.recipe])

  const handleCopyIngredients = async () => {
    if (!meal) return
    const lines = ingredients.length
      ? ingredients.map((item) => `${item.name}${item.quantity ? ` — ${item.quantity}` : ""}`)
      : [meal.name]
    const text = lines.join("\n")
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Ingredients copied", description: "Add them to your shopping list anytime." })
    } catch {
      toast({ title: "Copy failed", description: "Unable to copy ingredients to clipboard." })
    }
  }

  if (!meal) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <span className="text-2xl">{emoji}</span>
            {meal.name}
          </DialogTitle>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border px-3 py-1">{meal.time ?? "Any time"}</span>
            <span className="rounded-full border border-border px-3 py-1">{meal.kcal} kcal</span>
            <span className="rounded-full border border-border px-3 py-1">P {meal.protein_g}g</span>
            <span className="rounded-full border border-border px-3 py-1">C {meal.carbs_g}g</span>
            <span className="rounded-full border border-border px-3 py-1">F {meal.fat_g}g</span>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="px-6 pb-6 space-y-6">
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Ingredients</h4>
              {ingredients.length === 0 ? (
                <p className="text-sm text-muted-foreground">Detailed ingredients will appear here once added.</p>
              ) : (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {ingredients.map((item, index) => (
                    <li key={`${item.name}-${index}`} className="flex items-center justify-between">
                      <span>{item.name}</span>
                      {item.quantity && <span className="text-xs text-foreground">{item.quantity}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Steps</h4>
              {recipe.steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No steps yet. We&apos;ll show them once recipes are added.</p>
              ) : (
                <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                  {recipe.steps.map((step, index) => (
                    <li key={`${step}-${index}`}>{step}</li>
                  ))}
                </ol>
              )}
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Tips</h4>
                {recipe.tips.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Add your cooking tips here when available.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {recipe.tips.map((tip, index) => (
                      <li key={`${tip}-${index}`}>{tip}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Substitutions</h4>
                {recipe.substitutions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">We&apos;ll suggest swaps once recipes are expanded.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {recipe.substitutions.map((tip, index) => (
                      <li key={`${tip}-${index}`}>{tip}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </ScrollArea>

        <div className="border-t border-border p-4 flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyIngredients}>
            <Clipboard className="h-3 w-3 mr-1" />
            Add ingredients to shopping list
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onAdaptMeal(meal)
              onOpenChange(false)
            }}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Adapt with AI
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

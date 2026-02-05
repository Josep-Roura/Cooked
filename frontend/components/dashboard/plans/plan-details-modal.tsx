"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Trash2, Loader } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NotionModal } from "@/components/ui/notion-modal"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import type { PlanWeekMeal } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"

interface PlanDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  meal: PlanWeekMeal | null
  onDelete?: () => void
}

interface RecipeFromJsonb {
  title: string
  servings?: number
  ingredients?: Array<{
    name: string
    quantity?: number
    unit?: string
  }>
  steps?: string[]
  notes?: string
}

export function PlanDetailsModal({ open, onOpenChange, meal, onDelete }: PlanDetailsModalProps) {
  const { user } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteMeal = async () => {
    if (!meal) return

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${meal.name}? This action cannot be undone.`
    )
    if (!confirmDelete) return

    setIsDeleting(true)
    try {
      console.log("Deleting meal:", { date: meal.date, slot: meal.slot })
      
      const response = await fetch("/api/v1/nutrition/meal/delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: meal.date,
          slot: meal.slot,
        }),
      })

      console.log("Delete response:", response.status, response.ok)

      if (!response.ok) {
        let errorMessage = "Failed to delete meal"
        try {
          const error = await response.json()
          console.error("Delete error:", error)
          errorMessage = error.error || error.details || errorMessage
        } catch (parseError) {
          console.error("Could not parse error response:", parseError)
          const text = await response.text()
          console.error("Response text:", text)
          errorMessage = text || `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log("Delete success:", data)

      toast({
        title: "Meal deleted",
        description: `${meal.name} has been removed from your plan.`,
      })

      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ["db", "plan-week"] })
      
      // Close modal
      onOpenChange(false)
      
      // Call optional callback
      onDelete?.()
    } catch (error) {
      console.error("Delete meal error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete meal",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (!meal) {
    return (
      <NotionModal open={open} onOpenChange={onOpenChange} title="Meal details">
        <p className="text-sm text-muted-foreground">Select a meal to see details.</p>
      </NotionModal>
    )
  }

  // Extract recipe data from JSONB field (prioritize JSONB over summary)
  const recipeJsonb = meal.recipe as RecipeFromJsonb | null
  const title = recipeJsonb?.title ?? meal.name
  const description = meal.time ? `Planned for ${meal.time}` : "Meal time flexible"
  
  // Get ingredients from JSONB recipe
  const ingredients = recipeJsonb?.ingredients ?? meal.recipe_ingredients ?? []
  
  // Get steps from JSONB recipe
  const steps = recipeJsonb?.steps ?? []

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
            {ingredients.length > 0 ? (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {ingredients.map((ingredient, idx) => {
                  const name = ingredient.name || ""
                  const quantity = "quantity" in ingredient ? ingredient.quantity : null
                  const unit = "unit" in ingredient ? ingredient.unit : null
                  const hasQuantity = quantity !== null && quantity !== undefined && quantity !== ""

                  return (
                    <li key={idx}>
                      {name}
                      {hasQuantity ? ` · ${quantity}` : ""}
                      {unit ? ` ${unit}` : ""}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No ingredients listed.</p>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Recipe steps</h3>
            {steps.length > 0 ? (
              <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
                {steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted-foreground">No steps provided.</p>
            )}
          </div>
        </div>

        <div className="space-y-3 border-t border-border/50 pt-4">
          <div className="text-xs text-muted-foreground">
            Planned for {format(new Date(meal.date), "EEEE, MMM d")}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900/30"
            onClick={handleDeleteMeal}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete meal
              </>
            )}
          </Button>
        </div>
      </div>
    </NotionModal>
  )
}

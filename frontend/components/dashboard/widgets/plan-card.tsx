"use client"

import { ChevronLeft, ChevronRight, Utensils } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import type { Meal, NutritionDayPlan } from "@/lib/db/types"

interface PlanCardProps {
  date: string
  onPreviousDay: () => void
  onNextDay: () => void
  plan: NutritionDayPlan | null
  isLoading: boolean
  isUpdating: boolean
  onToggleMeal: (slot: number, completed: boolean) => void
}

function formatMealMacros(meal: Meal) {
  return [
    { label: "kcal", value: meal.kcal },
    { label: "P", value: meal.protein_g },
    { label: "C", value: meal.carbs_g },
    { label: "F", value: meal.fat_g },
  ]
}

export function PlanCard({
  date,
  onPreviousDay,
  onNextDay,
  plan,
  isLoading,
  isUpdating,
  onToggleMeal,
}: PlanCardProps) {
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
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-full h-8 w-8 p-0" onClick={onPreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
          <Button variant="outline" className="rounded-full h-8 w-8 p-0" onClick={onNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {plan && plan.meals.length > 0 ? (
        <Accordion type="multiple" className="space-y-2">
          {plan.meals.map((meal) => {
            const checkboxId = `meal-${date}-${meal.slot}`
            return (
              <AccordionItem key={meal.slot} value={String(meal.slot)} className="border border-border rounded-xl px-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 pt-4">
                    <Checkbox
                      id={checkboxId}
                      checked={meal.completed ?? false}
                      onCheckedChange={(checked) => onToggleMeal(meal.slot, Boolean(checked))}
                      disabled={isUpdating}
                    />
                    <label htmlFor={checkboxId} className="text-xs text-muted-foreground">
                      I ate this
                    </label>
                  </div>
                  <AccordionTrigger className="hover:no-underline flex-1">
                    <div className="flex flex-1 flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{meal.name}</p>
                        <span className="text-xs text-muted-foreground">{meal.time}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {formatMealMacros(meal).map((macro) => (
                          <Badge key={macro.label} variant="secondary" className="text-[10px]">
                            {macro.value}
                            {macro.label === "kcal" ? " kcal" : `${macro.label}g`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </AccordionTrigger>
                </div>
                <AccordionContent>
                  <div className="pl-7 text-xs text-muted-foreground">
                    {meal.ingredients && meal.ingredients.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1">
                        {meal.ingredients.map((ingredient, index) => (
                          <li key={`${meal.slot}-ingredient-${index}`}>{ingredient}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No ingredients listed yet.</p>
                    )}
                    {meal.notes && <p className="mt-2">{meal.notes}</p>}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      ) : (
        <div className="bg-muted rounded-xl p-4">
          <EmptyState
            icon={Utensils}
            title="No plan for this day"
            description="Your daily meal plan will appear here once it's generated."
          />
        </div>
      )}
    </div>
  )
}

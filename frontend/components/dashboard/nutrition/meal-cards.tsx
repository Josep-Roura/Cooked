"use client"

import { useMemo, useState } from "react"
import { Clock, Flame, Utensils } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { RecipeDetailsDialog } from "@/components/dashboard/nutrition/recipe-details-dialog"
import type { MealPlanDay, MealPlanItem, NutritionMacros } from "@/lib/db/types"

interface MealCardsProps {
  mealPlan?: MealPlanDay | null
  target?: NutritionMacros | null
  selectedDate: string
  search: string
  isLoading: boolean
  isUpdating: boolean
  dayTypeLabel?: string
  dayTypeNote?: string
  onToggleMeal: (mealId: string, eaten: boolean) => void
  onAdaptMeal: (meal: MealPlanItem) => void
}

const dayTypeColors: Record<string, string> = {
  training: "bg-amber-100 border-amber-200",
  rest: "bg-indigo-100 border-indigo-200",
  recovery: "bg-indigo-100 border-indigo-200",
  high: "bg-red-100 border-red-200",
}

const mealEmojiMap = [
  { match: ["breakfast"], emoji: "🍳" },
  { match: ["oats", "oatmeal", "porridge", "granola"], emoji: "🥣" },
  { match: ["snack"], emoji: "🍌" },
  { match: ["nuts", "almond", "peanut", "trail"], emoji: "🥜" },
  { match: ["lunch"], emoji: "🥗" },
  { match: ["dinner"], emoji: "🍝" },
  { match: ["pasta", "rice", "bowl"], emoji: "🍚" },
  { match: ["shake", "protein", "smoothie"], emoji: "🥤" },
]

const fuelEmojis: Record<string, string> = {
  fuel_pre: "⚡️",
  fuel_intra: "💧",
  fuel_post: "🍯",
}

function getMealEmoji(meal: MealPlanItem) {
  if (meal.meal_type && fuelEmojis[meal.meal_type]) {
    return fuelEmojis[meal.meal_type]
  }
  if (meal.emoji) return meal.emoji
  const name = meal.name.toLowerCase()
  const type = meal.meal_type?.toLowerCase() ?? ""
  const match = mealEmojiMap.find((entry) =>
    entry.match.some((keyword) => name.includes(keyword) || type.includes(keyword)),
  )
  return match?.emoji ?? "🥗"
}

function filterMeals(meals: MealPlanItem[], search: string) {
  if (!search.trim()) {
    return meals
  }
  const query = search.trim().toLowerCase()
  return meals.filter((meal) => meal.name.toLowerCase().includes(query) || (meal.time ?? "").includes(query))
}

export function MealCards({
  mealPlan,
  target,
  selectedDate,
  search,
  isLoading,
  isUpdating,
  dayTypeLabel,
  dayTypeNote,
  onToggleMeal,
  onAdaptMeal,
}: MealCardsProps) {
  const meals = mealPlan?.items ?? []
  const filteredMeals = filterMeals(meals, search)
  const [activeMeal, setActiveMeal] = useState<MealPlanItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const hasMeals = meals.length > 0
  const dayType = dayTypeLabel ?? "Training day"
  const dayTypeKey =
    dayTypeLabel && dayTypeLabel.toLowerCase().includes("rest") ? "rest" : "training"
  const calories = target?.kcal ?? 0
  const protein = target?.protein_g ?? 0
  const carbs = target?.carbs_g ?? 0
  const fat = target?.fat_g ?? 0
  const formattedDate = selectedDate ? format(parseISO(selectedDate), "EEE, MMM d") : ""
  const { regularMeals, fuelMeals, fuelGroups } = useMemo(() => {
    const fuel = filteredMeals.filter((meal) => meal.meal_type?.startsWith("fuel_"))
    const regular = filteredMeals.filter((meal) => !meal.meal_type?.startsWith("fuel_"))
    const groups = fuel.reduce((map, meal) => {
      const recipe = meal.recipe as { workout?: { id?: number; title?: string; start_time?: string } } | null
      const workout = recipe?.workout ?? {}
      const key = workout?.id ? String(workout.id) : workout?.title ?? "fuel"
      if (!map.has(key)) {
        map.set(key, {
          title: workout?.title ?? "Workout fuel",
          time: workout?.start_time ?? null,
          meals: [] as MealPlanItem[],
        })
      }
      map.get(key)?.meals.push(meal)
      return map
    }, new Map<string, { title: string; time: string | null; meals: MealPlanItem[] }>())
    return {
      regularMeals: regular,
      fuelMeals: fuel,
      fuelGroups: Array.from(groups.values()),
    }
  }, [filteredMeals])

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        {formattedDate ? `Meals for ${formattedDate}` : "Meals"}
      </h3>
      {(mealPlan || target) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-4">
          <span className="capitalize">{dayType}</span>
          <span>{calories} kcal</span>
          <span>P: {protein}g</span>
          <span>C: {carbs}g</span>
          <span>F: {fat}g</span>
        </div>
      )}
      {dayTypeNote && <p className="text-xs text-muted-foreground mb-4">{dayTypeNote}</p>}
      {hasMeals && filteredMeals.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title="No meals found"
          description="Try adjusting your search."
        />
      ) : !hasMeals ? (
        <EmptyState
          icon={Utensils}
          title="No meals yet"
          description="Once your nutrition plan is loaded, meals will appear here."
        />
      ) : filteredMeals.length > 0 ? (
        <div className="space-y-6">
          {fuelMeals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Workout fuel</h4>
                <span className="text-xs text-muted-foreground">{fuelMeals.length} items</span>
              </div>
              <div className="space-y-3">
                {fuelGroups.map((group) => (
                  <div key={group.title} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{group.title}</span>
                      <span>{group.time ? `Start ${group.time}` : ""}</span>
                    </div>
                    <div className="space-y-2">
                      {group.meals.map((meal) => (
                        <div
                          key={meal.id}
                          className="rounded-lg border border-border bg-background p-3 flex items-start gap-3"
                        >
                          <div className="text-xl">{getMealEmoji(meal)}</div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{meal.name}</p>
                              {meal.eaten && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  Logged
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {meal.time ?? "Any time"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Flame className="h-3 w-3" />
                                {meal.kcal} kcal
                              </span>
                              <span className="flex items-center gap-2">
                                <Checkbox
                                  checked={meal.eaten}
                                  onCheckedChange={(checked) => onToggleMeal(meal.id, Boolean(checked))}
                                  disabled={isUpdating}
                                />
                                <span className="text-xs text-muted-foreground">I took this</span>
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] px-2 py-1 bg-cyan-500/20 text-cyan-700 rounded-full">
                                P: {meal.protein_g}g
                              </span>
                              <span className="text-[10px] px-2 py-1 bg-orange-500/20 text-orange-700 rounded-full">
                                C: {meal.carbs_g}g
                              </span>
                              <span className="text-[10px] px-2 py-1 bg-purple-500/20 text-purple-700 rounded-full">
                                F: {meal.fat_g}g
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {regularMeals.length > 0 && (
            <div className="space-y-3">
              {regularMeals.map((meal) => (
                <button
                  type="button"
                  key={meal.id}
                  onClick={() => {
                    setActiveMeal(meal)
                    setDialogOpen(true)
                  }}
                  className={`w-full text-left p-4 rounded-xl border ${
                    meal.eaten
                      ? "bg-emerald-50 border-emerald-200"
                      : dayTypeColors[dayTypeKey] ?? "bg-green-100 border-green-200"
                  } transition-all hover:shadow-sm`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{getMealEmoji(meal)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground">{meal.name}</h4>
                        {meal.eaten && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Eaten
                          </span>
                        )}
                        {meal.notes && <span className="text-xs text-muted-foreground">{meal.notes}</span>}
                      </div>
                      <div className="flex items-center flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {meal.time ?? "Any time"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Flame className="h-3 w-3" />
                          {meal.kcal} kcal
                        </span>
                        <span className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={meal.eaten}
                            onCheckedChange={(checked) => onToggleMeal(meal.id, Boolean(checked))}
                            disabled={isUpdating}
                          />
                          <span className="text-xs text-muted-foreground">I ate this</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-700 rounded-full">
                          P: {meal.protein_g}g
                        </span>
                        <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-700 rounded-full">
                          C: {meal.carbs_g}g
                        </span>
                        <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-700 rounded-full">
                          F: {meal.fat_g}g
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <RecipeDetailsDialog
        meal={activeMeal}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setActiveMeal(null)
        }}
        onAdaptMeal={(meal) => onAdaptMeal(meal)}
        emoji={activeMeal ? getMealEmoji(activeMeal) : "🥗"}
      />
    </div>
  )
}

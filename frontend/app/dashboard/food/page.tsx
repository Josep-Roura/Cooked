"use client"

import { useMemo, useState } from "react"
import { endOfWeek, format, startOfWeek, eachDayOfInterval, isSameDay } from "date-fns"
import { useQueryClient } from "@tanstack/react-query"
import { Check, ChefHat, ListChecks, ShoppingBasket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { useSession } from "@/hooks/use-session"
import { useGrocery, useMealLog, useMealPrep, useMealSchedule, useRecipes } from "@/lib/db/hooks"
import type { GroceryItem, MealScheduleItem } from "@/lib/db/types"

export default function FoodPage() {
  const { user } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isGenerating, setIsGenerating] = useState(false)

  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  const startDate = format(weekStart, "yyyy-MM-dd")
  const endDate = format(weekEnd, "yyyy-MM-dd")

  const recipesQuery = useRecipes(user?.id)
  const scheduleQuery = useMealSchedule(user?.id, startDate, endDate)
  const groceryQuery = useGrocery(user?.id, startDate, endDate)
  const mealPrepQuery = useMealPrep(user?.id, startDate, endDate)
  const mealLogQuery = useMealLog(user?.id, format(today, "yyyy-MM-dd"))

  const scheduleByDate = useMemo(() => {
    const map = new Map<string, MealScheduleItem[]>()
    scheduleQuery.data?.forEach((item) => {
      if (!map.has(item.date)) {
        map.set(item.date, [])
      }
      map.get(item.date)?.push(item)
    })
    map.forEach((items) => items.sort((a, b) => a.slot - b.slot))
    return map
  }, [scheduleQuery.data])

  const loggedSlots = useMemo(() => {
    const set = new Set<number>()
    mealLogQuery.data?.forEach((entry) => {
      if (entry.is_eaten) {
        set.add(entry.slot)
      }
    })
    return set
  }, [mealLogQuery.data])

  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd],
  )

  const handleGenerateGrocery = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch("/api/v1/food/grocery/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: startDate, end: endDate }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Unable to generate grocery list.")
      }
      await groceryQuery.refetch()
      toast({ title: "Grocery list updated", description: "Weekly ingredients have been added." })
    } catch (error) {
      toast({
        title: "Grocery list failed",
        description: error instanceof Error ? error.message : "Unable to generate grocery list.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleToggleBought = async (item: GroceryItem) => {
    const response = await fetch(`/api/v1/food/grocery/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_bought: !item.is_bought }),
    })
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      toast({
        title: "Update failed",
        description: errorBody?.error ?? "Unable to update grocery item.",
        variant: "destructive",
      })
      return
    }
    await queryClient.invalidateQueries({ queryKey: ["db", "food-grocery"] })
  }

  if (recipesQuery.isError || scheduleQuery.isError || groceryQuery.isError || mealPrepQuery.isError) {
    return (
      <main className="flex-1 p-8 overflow-auto">
        <ErrorState
          onRetry={() => {
            recipesQuery.refetch()
            scheduleQuery.refetch()
            groceryQuery.refetch()
            mealPrepQuery.refetch()
          }}
        />
      </main>
    )
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground">Food</h1>
          <p className="text-sm text-muted-foreground">
            Plan meals, track what you eat, and keep your grocery list up to date for the week ahead.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ChefHat className="h-4 w-4 text-primary" />
                Recipes
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {recipesQuery.data?.length ?? 0} total
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              {recipesQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ) : recipesQuery.data && recipesQuery.data.length > 0 ? (
                recipesQuery.data.slice(0, 4).map((recipe) => (
                  <div key={recipe.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-foreground">{recipe.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {recipe.category ?? "general"} · {recipe.servings} servings
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{recipe.macros_kcal} kcal</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recipes yet. Start with a favorite meal.</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-primary" />
                Weekly Planner
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              {scheduleQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {weekDays.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd")
                    const items = scheduleByDate.get(dateKey) ?? []
                    return (
                      <div key={dateKey} className="rounded-xl border border-border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">
                            {format(day, "EEE, MMM d")}
                          </span>
                          {isSameDay(day, today) && (
                            <span className="text-xs text-primary">Today</span>
                          )}
                        </div>
                        {items.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No meals planned.</p>
                        ) : (
                          <div className="space-y-2">
                            {items.map((meal) => (
                              <div key={meal.id} className="flex items-center justify-between text-xs">
                                <div>
                                  <p className="font-medium text-foreground">
                                    {meal.name}
                                  </p>
                                  <p className="text-muted-foreground">
                                    {meal.kcal} kcal · P{meal.protein_g} C{meal.carbs_g} F{meal.fat_g}
                                  </p>
                                </div>
                                {isSameDay(day, today) && loggedSlots.has(meal.slot) && (
                                  <span className="inline-flex items-center gap-1 text-primary">
                                    <Check className="h-3 w-3" /> Logged
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBasket className="h-4 w-4 text-primary" />
                Grocery List
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateGrocery}
                disabled={isGenerating || groceryQuery.isLoading}
              >
                {isGenerating ? "Generating..." : "Generate list"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {groceryQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-44" />
                </div>
              ) : groceryQuery.data && groceryQuery.data.length > 0 ? (
                groceryQuery.data.slice(0, 6).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-left"
                      onClick={() => handleToggleBought(item)}
                    >
                      <span
                        className={`h-3 w-3 rounded-full border ${
                          item.is_bought ? "bg-primary border-primary" : "border-muted-foreground"
                        }`}
                      />
                      <div>
                        <p className={`font-medium ${item.is_bought ? "line-through text-muted-foreground" : ""}`}>
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity ? `${item.quantity} ` : ""}
                          {item.unit ?? ""} {item.category ? `· ${item.category}` : ""}
                        </p>
                      </div>
                    </button>
                    <span className="text-xs text-muted-foreground">{item.source ?? "manual"}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No grocery items yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Meal Prep</CardTitle>
              <span className="text-xs text-muted-foreground">
                {mealPrepQuery.data?.length ?? 0} sessions
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              {mealPrepQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ) : mealPrepQuery.data && mealPrepQuery.data.length > 0 ? (
                mealPrepQuery.data.slice(0, 4).map((session) => (
                  <div key={session.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <p className="font-medium text-foreground">{session.title}</p>
                      <span className="text-xs text-muted-foreground">
                        {session.session_date ? format(new Date(session.session_date), "MMM d") : "Flexible"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {session.items?.length ?? 0} items · {session.duration_min ?? 0} min
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No prep sessions planned yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

"use client"

import { useMemo, useState } from "react"
import { endOfWeek, format, startOfWeek, eachDayOfInterval, isSameDay } from "date-fns"
import { useQueryClient } from "@tanstack/react-query"
import { Check, ChefHat, ListChecks, ShoppingBasket, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useSession } from "@/hooks/use-session"
import { useGrocery, useMealLog, useMealPrep, useMealSchedule, useRecipe, useRecipes } from "@/lib/db/hooks"
import type { GroceryItem, MealScheduleItem, Recipe } from "@/lib/db/types"

export default function FoodPage() {
  const { user } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isGenerating, setIsGenerating] = useState(false)
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false)
  const [viewRecipeId, setViewRecipeId] = useState<string | null>(null)
  const [recipeForm, setRecipeForm] = useState({
    title: "",
    emoji: "",
    servings: 1,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ingredients: "",
    steps: "",
    tags: "",
  })

  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  const startDate = format(weekStart, "yyyy-MM-dd")
  const endDate = format(weekEnd, "yyyy-MM-dd")

  const recipesQuery = useRecipes(user?.id)
  const recipeDetailsQuery = useRecipe(user?.id, viewRecipeId)
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

  const mealSlots = [
    { slot: 1, label: "Breakfast" },
    { slot: 2, label: "Lunch" },
    { slot: 3, label: "Dinner" },
    { slot: 4, label: "Snack" },
  ]

  const recipesById = useMemo(() => {
    const map = new Map<string, Recipe>()
    recipesQuery.data?.forEach((recipe) => map.set(recipe.id, recipe))
    return map
  }, [recipesQuery.data])

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

  const handleCreateRecipe = async () => {
    try {
      const ingredients = recipeForm.ingredients
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((name) => ({ name }))
      const steps = recipeForm.steps
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((instruction, index) => ({ step_number: index + 1, instruction }))
      const tags = recipeForm.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
      const response = await fetch("/api/v1/food/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: recipeForm.title,
          emoji: recipeForm.emoji,
          servings: recipeForm.servings,
          macros_kcal: recipeForm.kcal,
          macros_protein_g: recipeForm.protein,
          macros_carbs_g: recipeForm.carbs,
          macros_fat_g: recipeForm.fat,
          ingredients,
          steps,
          tags,
        }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Unable to create recipe.")
      }
      await recipesQuery.refetch()
      setRecipeForm({
        title: "",
        emoji: "",
        servings: 1,
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        ingredients: "",
        steps: "",
        tags: "",
      })
      setRecipeDialogOpen(false)
      toast({ title: "Recipe created", description: "Your recipe is ready to use." })
    } catch (error) {
      toast({
        title: "Recipe failed",
        description: error instanceof Error ? error.message : "Unable to create recipe.",
        variant: "destructive",
      })
    }
  }

  const handleAssignRecipe = async (dateKey: string, slot: number, recipeId: string | null) => {
    const recipe = recipeId ? recipesById.get(recipeId) : null
    const response = await fetch("/api/v1/food/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: dateKey,
        slot,
        name: recipe?.title ?? mealSlots.find((meal) => meal.slot === slot)?.label ?? "Meal",
        recipe_id: recipe?.id ?? null,
        kcal: recipe?.macros_kcal ?? 0,
        protein_g: recipe?.macros_protein_g ?? 0,
        carbs_g: recipe?.macros_carbs_g ?? 0,
        fat_g: recipe?.macros_fat_g ?? 0,
        ingredients: null,
      }),
    })
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      toast({
        title: "Planner update failed",
        description: errorBody?.error ?? "Unable to update meal plan.",
        variant: "destructive",
      })
      return
    }
    await queryClient.invalidateQueries({ queryKey: ["db", "food-schedule"] })
    toast({ title: "Planner updated", description: "Meal plan saved." })
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{recipesQuery.data?.length ?? 0} total</span>
                <Button variant="outline" size="icon" onClick={() => setRecipeDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
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
                  <button
                    key={recipe.id}
                    className="flex items-center justify-between text-sm text-left w-full"
                    onClick={() => setViewRecipeId(recipe.id)}
                    type="button"
                  >
                    <div>
                      <p className="font-medium text-foreground">{recipe.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {recipe.category ?? "general"} · {recipe.servings} servings
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{recipe.macros_kcal} kcal</span>
                  </button>
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
                      <div key={dateKey} className="rounded-xl border border-border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">
                            {format(day, "EEE, MMM d")}
                          </span>
                          {isSameDay(day, today) && (
                            <span className="text-xs text-primary">Today</span>
                          )}
                        </div>
                        <div className="space-y-3">
                          {mealSlots.map((slot) => {
                            const assigned = items.find((item) => item.slot === slot.slot)
                            return (
                              <div key={slot.slot} className="space-y-1">
                                <p className="text-xs text-muted-foreground">{slot.label}</p>
                                <Select
                                  value={assigned?.recipe_id ?? "none"}
                                  onValueChange={(value) =>
                                    handleAssignRecipe(dateKey, slot.slot, value === "none" ? null : value)
                                  }
                                >
                                  <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Pick a recipe" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No recipe</SelectItem>
                                    {(recipesQuery.data ?? []).map((recipe) => (
                                      <SelectItem key={recipe.id} value={recipe.id}>
                                        {recipe.title}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {assigned && (
                                  <p className="text-[11px] text-muted-foreground">
                                    {assigned.kcal} kcal · P{assigned.protein_g} C{assigned.carbs_g} F{assigned.fat_g}
                                    {isSameDay(day, today) && loggedSlots.has(assigned.slot) && (
                                      <span className="inline-flex items-center gap-1 text-primary ml-2">
                                        <Check className="h-3 w-3" /> Logged
                                      </span>
                                    )}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
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

      <Dialog open={recipeDialogOpen} onOpenChange={setRecipeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New recipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                placeholder="Emoji"
                value={recipeForm.emoji}
                onChange={(event) => setRecipeForm((prev) => ({ ...prev, emoji: event.target.value }))}
              />
              <Input
                placeholder="Recipe title"
                value={recipeForm.title}
                onChange={(event) => setRecipeForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <Input
                type="number"
                min={1}
                placeholder="Servings"
                value={recipeForm.servings}
                onChange={(event) => setRecipeForm((prev) => ({ ...prev, servings: Number(event.target.value) }))}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Input
                type="number"
                placeholder="kcal"
                value={recipeForm.kcal}
                onChange={(event) => setRecipeForm((prev) => ({ ...prev, kcal: Number(event.target.value) }))}
              />
              <Input
                type="number"
                placeholder="Protein g"
                value={recipeForm.protein}
                onChange={(event) => setRecipeForm((prev) => ({ ...prev, protein: Number(event.target.value) }))}
              />
              <Input
                type="number"
                placeholder="Carbs g"
                value={recipeForm.carbs}
                onChange={(event) => setRecipeForm((prev) => ({ ...prev, carbs: Number(event.target.value) }))}
              />
              <Input
                type="number"
                placeholder="Fat g"
                value={recipeForm.fat}
                onChange={(event) => setRecipeForm((prev) => ({ ...prev, fat: Number(event.target.value) }))}
              />
            </div>
            <Textarea
              placeholder="Ingredients (one per line)"
              value={recipeForm.ingredients}
              onChange={(event) => setRecipeForm((prev) => ({ ...prev, ingredients: event.target.value }))}
            />
            <Textarea
              placeholder="Steps (one per line)"
              value={recipeForm.steps}
              onChange={(event) => setRecipeForm((prev) => ({ ...prev, steps: event.target.value }))}
            />
            <Input
              placeholder="Tags (comma-separated)"
              value={recipeForm.tags}
              onChange={(event) => setRecipeForm((prev) => ({ ...prev, tags: event.target.value }))}
            />
            <Button onClick={handleCreateRecipe} className="w-full rounded-full text-xs" type="button">
              Save recipe
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewRecipeId)} onOpenChange={(open) => !open && setViewRecipeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{recipeDetailsQuery.data?.recipe?.title ?? "Recipe"}</DialogTitle>
          </DialogHeader>
          {recipeDetailsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex flex-wrap gap-3 text-xs">
                <span>{recipeDetailsQuery.data?.recipe?.servings ?? 1} servings</span>
                <span>{recipeDetailsQuery.data?.recipe?.macros_kcal ?? 0} kcal</span>
                <span>P{recipeDetailsQuery.data?.recipe?.macros_protein_g ?? 0}</span>
                <span>C{recipeDetailsQuery.data?.recipe?.macros_carbs_g ?? 0}</span>
                <span>F{recipeDetailsQuery.data?.recipe?.macros_fat_g ?? 0}</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground mb-1">Ingredients</p>
                <ul className="list-disc list-inside space-y-1">
                  {(recipeDetailsQuery.data?.ingredients ?? []).map((ingredient) => (
                    <li key={ingredient.id}>{ingredient.name}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground mb-1">Steps</p>
                <ol className="list-decimal list-inside space-y-1">
                  {(recipeDetailsQuery.data?.steps ?? []).map((step) => (
                    <li key={step.id}>{step.instruction}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}

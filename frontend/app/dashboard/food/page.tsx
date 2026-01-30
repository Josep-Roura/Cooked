"use client"

import { useEffect, useMemo, useState } from "react"
import {
  addDays,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
  subDays,
} from "date-fns"
import {
  ChefHat,
  Clock,
  Flame,
  ListChecks,
  NotebookPen,
  Plus,
  Search,
  ShoppingBasket,
  Soup,
} from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { CenteredModal } from "@/components/ui/centered-modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/use-toast"
import { useSession } from "@/hooks/use-session"
import {
  useGrocery,
  useMealLogRange,
  useMealPrep,
  useMealSchedule,
  usePlanWeek,
  useRecipe,
  useRecipes,
} from "@/lib/db/hooks"
import type { GroceryItem, MealScheduleItem, PlanWeekMeal, Recipe, RecipeIngredient, RecipeStep } from "@/lib/db/types"

const mealSlots = [
  { slot: 1, label: "Breakfast" },
  { slot: 2, label: "Lunch" },
  { slot: 3, label: "Dinner" },
  { slot: 4, label: "Snack" },
]

const recipeCategories = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
  { value: "preworkout", label: "Pre-workout" },
  { value: "postworkout", label: "Post-workout" },
  { value: "other", label: "Other" },
]

const groceryCategories = ["produce", "dairy", "meat/fish", "pantry", "frozen", "other"]

type IngredientDraft = {
  id: string
  name: string
  quantity: string
  unit: string
  category: string
  optional: boolean
}

type StepDraft = {
  id: string
  instruction: string
  timer: string
}

type RecipeFormState = {
  title: string
  emoji: string
  description: string
  servings: number
  cook_time_min: number
  tags: string
  category: string
  macros_kcal: number
  macros_protein_g: number
  macros_carbs_g: number
  macros_fat_g: number
  ingredients: IngredientDraft[]
  steps: StepDraft[]
}

const createId = () => Math.random().toString(36).slice(2, 9)

const emptyRecipeForm: RecipeFormState = {
  title: "",
  emoji: "",
  description: "",
  servings: 1,
  cook_time_min: 20,
  tags: "",
  category: "",
  macros_kcal: 0,
  macros_protein_g: 0,
  macros_carbs_g: 0,
  macros_fat_g: 0,
  ingredients: [{ id: createId(), name: "", quantity: "", unit: "", category: "", optional: false }],
  steps: [{ id: createId(), instruction: "", timer: "" }],
}

const formatMacro = (value?: number | null) => (value ? Math.round(value) : 0)

const formatIngredient = (ingredient: RecipeIngredient) => {
  const qty = ingredient.quantity ? `${ingredient.quantity} ` : ""
  const unit = ingredient.unit ? `${ingredient.unit} ` : ""
  return `${qty}${unit}${ingredient.name}`
}

function groupGroceryItems(items: GroceryItem[]) {
  const grouped = new Map<string, GroceryItem[]>()
  items.forEach((item) => {
    const key = item.category ?? "other"
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)?.push(item)
  })
  return grouped
}

function buildPlannerKey(date: string, slot: number) {
  return `${date}-${slot}`
}

export default function FoodPage() {
  const { user } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [today] = useState(() => new Date())
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  const startDate = format(weekStart, "yyyy-MM-dd")
  const endDate = format(weekEnd, "yyyy-MM-dd")

  const [groceryStart, setGroceryStart] = useState(startDate)
  const [groceryEnd, setGroceryEnd] = useState(endDate)
  const cookedRangeStart = format(subDays(today, 14), "yyyy-MM-dd")
  const cookedRangeEnd = format(today, "yyyy-MM-dd")

  const recipesQuery = useRecipes(user?.id)
  const [detailRecipeId, setDetailRecipeId] = useState<string | null>(null)
  const recipeDetailsQuery = useRecipe(user?.id, detailRecipeId)
  const scheduleQuery = useMealSchedule(user?.id, startDate, endDate)
  const groceryQuery = useGrocery(user?.id, groceryStart, groceryEnd)
  const mealPrepQuery = useMealPrep(user?.id, startDate, endDate)
  const planWeekQuery = usePlanWeek(user?.id, startDate, endDate)
  const mealLogRangeQuery = useMealLogRange(user?.id, cookedRangeStart, cookedRangeEnd)

  const [recipeModalOpen, setRecipeModalOpen] = useState(false)
  const [recipeModalMode, setRecipeModalMode] = useState<"create" | "edit">("create")
  const [cookModeOpen, setCookModeOpen] = useState(false)
  const [groceryModalOpen, setGroceryModalOpen] = useState(false)
  const [plannerModalOpen, setPlannerModalOpen] = useState(false)
  const [plannerSelection, setPlannerSelection] = useState<{ date: string; slot: number } | null>(null)
  const [plannerRecipeId, setPlannerRecipeId] = useState<string | null>(null)

  const [recipeForm, setRecipeForm] = useState<RecipeFormState>(emptyRecipeForm)
  const [recipeSearch, setRecipeSearch] = useState("")
  const [tagFilter, setTagFilter] = useState("all")
  const [cuisineFilter, setCuisineFilter] = useState("all")
  const [difficultyFilter, setDifficultyFilter] = useState("all")
  const [timeFilter, setTimeFilter] = useState("all")
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sortBy, setSortBy] = useState("recent")
  const [slotSearch, setSlotSearch] = useState("")
  const [groceryDraft, setGroceryDraft] = useState({ name: "", quantity: "", unit: "", category: "other", notes: "" })
  const [groceryBusy, setGroceryBusy] = useState(false)

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

  const planMealsByKey = useMemo(() => {
    const map = new Map<string, PlanWeekMeal>()
    planWeekQuery.data?.forEach((meal) => {
      map.set(buildPlannerKey(meal.date, meal.slot), meal)
    })
    return map
  }, [planWeekQuery.data])

  const cookedHistory = useMemo(() => {
    const entries = mealLogRangeQuery.data ?? []
    const history = entries
      .filter((entry) => entry.is_eaten)
      .map((entry) => {
        const key = buildPlannerKey(entry.date, entry.slot)
        const scheduleItem = scheduleByDate.get(entry.date)?.find((item) => item.slot === entry.slot) ?? null
        const planMeal = planMealsByKey.get(key) ?? null
        const recipeId = scheduleItem?.recipe_id ?? planMeal?.recipe_id ?? null
        const name = scheduleItem?.name ?? planMeal?.name ?? `Meal ${entry.slot}`
        const macros = scheduleItem
          ? { kcal: scheduleItem.kcal, protein: scheduleItem.protein_g, carbs: scheduleItem.carbs_g, fat: scheduleItem.fat_g }
          : planMeal
            ? { kcal: planMeal.kcal, protein: planMeal.protein_g, carbs: planMeal.carbs_g, fat: planMeal.fat_g }
            : { kcal: 0, protein: 0, carbs: 0, fat: 0 }
        return {
          ...entry,
          name,
          recipeId,
          macros,
        }
      })

    return history.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8)
  }, [mealLogRangeQuery.data, planMealsByKey, scheduleByDate])

  const lastCookedByRecipe = useMemo(() => {
    const map = new Map<string, string>()
    cookedHistory.forEach((entry) => {
      if (!entry.recipeId) return
      map.set(entry.recipeId, entry.date)
    })
    return map
  }, [cookedHistory])

  const tagOptions = useMemo(() => {
    const tags = new Set<string>()
    recipesQuery.data?.forEach((recipe) => recipe.tags?.forEach((tag) => tags.add(tag)))
    return Array.from(tags).sort()
  }, [recipesQuery.data])

  const cuisineOptions = useMemo(() => {
    const cuisines = new Set<string>()
    recipesQuery.data?.forEach((recipe) => {
      recipe.tags?.forEach((tag) => {
        if (tag.startsWith("cuisine:")) {
          cuisines.add(tag.replace("cuisine:", "").trim())
        }
      })
    })
    return Array.from(cuisines).sort()
  }, [recipesQuery.data])

  const difficultyOptions = useMemo(() => {
    const difficulties = new Set<string>()
    recipesQuery.data?.forEach((recipe) => {
      recipe.tags?.forEach((tag) => {
        if (tag.startsWith("difficulty:")) {
          difficulties.add(tag.replace("difficulty:", "").trim())
        }
      })
    })
    return Array.from(difficulties).sort()
  }, [recipesQuery.data])

  const filteredRecipes = useMemo(() => {
    let list = recipesQuery.data ?? []
    if (recipeSearch.trim()) {
      const query = recipeSearch.toLowerCase()
      list = list.filter((recipe) => recipe.title.toLowerCase().includes(query))
    }
    if (tagFilter !== "all") {
      list = list.filter((recipe) => recipe.tags?.includes(tagFilter))
    }
    if (cuisineFilter !== "all") {
      list = list.filter((recipe) =>
        recipe.tags?.some((tag) =>
          tag.toLowerCase() === cuisineFilter.toLowerCase() ||
          tag.toLowerCase() === `cuisine:${cuisineFilter.toLowerCase()}`,
        ),
      )
    }
    if (difficultyFilter !== "all") {
      list = list.filter((recipe) =>
        recipe.tags?.some((tag) =>
          tag.toLowerCase() === difficultyFilter.toLowerCase() ||
          tag.toLowerCase() === `difficulty:${difficultyFilter.toLowerCase()}`,
        ),
      )
    }
    if (favoritesOnly) {
      list = list.filter((recipe) => recipe.tags?.some((tag) => tag.toLowerCase() === "favorite"))
    }
    if (timeFilter !== "all") {
      list = list.filter((recipe) => {
        const time = recipe.cook_time_min ?? 0
        if (timeFilter === "quick") return time <= 20
        if (timeFilter === "medium") return time > 20 && time <= 45
        return time > 45
      })
    }
    if (sortBy === "last_cooked") {
      list = [...list].sort((a, b) => {
        const aDate = lastCookedByRecipe.get(a.id) ?? ""
        const bDate = lastCookedByRecipe.get(b.id) ?? ""
        return bDate.localeCompare(aDate)
      })
    } else {
      list = [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    }
    return list
  }, [
    recipesQuery.data,
    recipeSearch,
    tagFilter,
    cuisineFilter,
    difficultyFilter,
    favoritesOnly,
    timeFilter,
    sortBy,
    lastCookedByRecipe,
  ])

  const handleOpenCreate = () => {
    setRecipeModalMode("create")
    setRecipeForm({ ...emptyRecipeForm, ingredients: [{ id: createId(), name: "", quantity: "", unit: "", category: "", optional: false }], steps: [{ id: createId(), instruction: "", timer: "" }] })
    setRecipeModalOpen(true)
  }

  const handleOpenEdit = (recipe: Recipe, ingredients: RecipeIngredient[], steps: RecipeStep[]) => {
    setRecipeModalMode("edit")
    setRecipeForm({
      title: recipe.title,
      emoji: recipe.emoji ?? "",
      description: recipe.description ?? "",
      servings: recipe.servings,
      cook_time_min: recipe.cook_time_min ?? 0,
      tags: recipe.tags?.join(", ") ?? "",
      category: recipe.category ?? "",
      macros_kcal: recipe.macros_kcal ?? 0,
      macros_protein_g: recipe.macros_protein_g ?? 0,
      macros_carbs_g: recipe.macros_carbs_g ?? 0,
      macros_fat_g: recipe.macros_fat_g ?? 0,
      ingredients: ingredients.length
        ? ingredients.map((ingredient) => ({
            id: ingredient.id,
            name: ingredient.name,
            quantity: ingredient.quantity?.toString() ?? "",
            unit: ingredient.unit ?? "",
            category: ingredient.category ?? "",
            optional: ingredient.optional,
          }))
        : [{ id: createId(), name: "", quantity: "", unit: "", category: "", optional: false }],
      steps: steps.length
        ? steps.map((step) => ({
            id: step.id,
            instruction: step.instruction,
            timer: step.timer_seconds ? String(step.timer_seconds / 60) : "",
          }))
        : [{ id: createId(), instruction: "", timer: "" }],
    })
    setRecipeModalOpen(true)
  }

  const handleSaveRecipe = async () => {
    if (recipeModalMode === "edit" && !detailRecipeId) {
      toast({ title: "Recipe save failed", description: "Missing recipe to update.", variant: "destructive" })
      return
    }
    const tags = recipeForm.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
    const ingredients = recipeForm.ingredients
      .map((ingredient) => ({
        name: ingredient.name.trim(),
        quantity: ingredient.quantity ? Number(ingredient.quantity) : null,
        unit: ingredient.unit.trim() || null,
        category: ingredient.category.trim() || "other",
        optional: ingredient.optional,
      }))
      .filter((ingredient) => ingredient.name)
    const steps = recipeForm.steps
      .map((step, index) => ({
        step_number: index + 1,
        instruction: step.instruction.trim(),
        timer_seconds: step.timer ? Number(step.timer) * 60 : null,
      }))
      .filter((step) => step.instruction)

    const payload = {
      title: recipeForm.title,
      emoji: recipeForm.emoji,
      description: recipeForm.description,
      servings: recipeForm.servings,
      cook_time_min: recipeForm.cook_time_min,
      tags,
      category: recipeForm.category || null,
      macros_kcal: recipeForm.macros_kcal,
      macros_protein_g: recipeForm.macros_protein_g,
      macros_carbs_g: recipeForm.macros_carbs_g,
      macros_fat_g: recipeForm.macros_fat_g,
      ingredients,
      steps,
    }

    try {
      const endpoint = recipeModalMode === "create" ? "/api/v1/food/recipes" : `/api/v1/food/recipes/${detailRecipeId}`
      const method = recipeModalMode === "create" ? "POST" : "PATCH"
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Unable to save recipe.")
      }
      await recipesQuery.refetch()
      if (detailRecipeId) {
        await queryClient.invalidateQueries({ queryKey: ["db", "food-recipe", user?.id, detailRecipeId] })
      }
      setRecipeModalOpen(false)
      toast({ title: recipeModalMode === "create" ? "Recipe created" : "Recipe updated" })
    } catch (error) {
      toast({
        title: "Recipe save failed",
        description: error instanceof Error ? error.message : "Unable to save recipe.",
        variant: "destructive",
      })
    }
  }

  const handleAssignRecipe = async (dateKey: string, slot: number, recipeId: string | null) => {
    const recipe = recipesQuery.data?.find((item) => item.id === recipeId) ?? null
    let ingredients = null
    if (recipeId) {
      const response = await fetch(`/api/v1/food/recipes/${recipeId}`)
      if (response.ok) {
        const data = await response.json().catch(() => null)
        ingredients = data?.ingredients ?? null
      }
    }

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
        ingredients: ingredients ?? null,
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

  const handleAddRecipeToGrocery = async (ingredients: RecipeIngredient[]) => {
    if (!ingredients.length) return
    try {
      const requests = ingredients.map((ingredient) =>
        fetch("/api/v1/food/grocery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            category: ingredient.category ?? "other",
            is_bought: false,
            source: "recipe",
            recipe_id: ingredient.recipe_id,
            date_range_start: groceryStart,
            date_range_end: groceryEnd,
          }),
        }),
      )
      await Promise.all(requests)
      await groceryQuery.refetch()
      toast({ title: "Grocery list updated", description: "Ingredients added to your list." })
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unable to update grocery list.",
        variant: "destructive",
      })
    }
  }

  const handleToggleBought = async (item: GroceryItem, is_bought?: boolean) => {
    const response = await fetch(`/api/v1/food/grocery/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_bought: is_bought ?? !item.is_bought }),
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

  const handleUpdateGroceryItem = async (item: GroceryItem, updates: Partial<GroceryItem>) => {
    const response = await fetch(`/api/v1/food/grocery/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
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
    await groceryQuery.refetch()
  }

  const handleDeleteGroceryItem = async (itemId: string) => {
    const response = await fetch(`/api/v1/food/grocery/${itemId}`, { method: "DELETE" })
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      toast({
        title: "Delete failed",
        description: errorBody?.error ?? "Unable to delete grocery item.",
        variant: "destructive",
      })
      return
    }
    await groceryQuery.refetch()
  }

  const handleAddGroceryItem = async () => {
    if (!groceryDraft.name.trim()) return
    setGroceryBusy(true)
    try {
      const response = await fetch("/api/v1/food/grocery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groceryDraft.name,
          quantity: groceryDraft.quantity ? Number(groceryDraft.quantity) : null,
          unit: groceryDraft.unit || null,
          category: groceryDraft.category,
          notes: groceryDraft.notes || null,
          is_bought: false,
          source: "manual",
          date_range_start: groceryStart,
          date_range_end: groceryEnd,
        }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Unable to add grocery item.")
      }
      await groceryQuery.refetch()
      setGroceryDraft({ name: "", quantity: "", unit: "", category: "other", notes: "" })
    } catch (error) {
      toast({
        title: "Add failed",
        description: error instanceof Error ? error.message : "Unable to add grocery item.",
        variant: "destructive",
      })
    } finally {
      setGroceryBusy(false)
    }
  }

  const handleExportPdf = async () => {
    try {
      const response = await fetch(`/api/v1/grocery/pdf?start=${groceryStart}&end=${groceryEnd}`)
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Unable to export PDF.")
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `grocery-list-${groceryStart}-to-${groceryEnd}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unable to export PDF.",
        variant: "destructive",
      })
    }
  }

  const handleGenerateGrocery = async () => {
    try {
      const response = await fetch("/api/v1/food/grocery/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: groceryStart, end: groceryEnd }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Unable to generate grocery list.")
      }
      await groceryQuery.refetch()
      toast({ title: "Grocery list updated", description: "Your list is ready." })
    } catch (error) {
      toast({
        title: "Grocery list failed",
        description: error instanceof Error ? error.message : "Unable to generate grocery list.",
        variant: "destructive",
      })
    }
  }

  const handlePlannerOpen = (date: string, slot: number, recipeId?: string | null) => {
    setPlannerSelection({ date, slot })
    setPlannerRecipeId(recipeId ?? null)
    setPlannerModalOpen(true)
    setSlotSearch("")
  }

  const groupedGroceries = useMemo(() => groupGroceryItems(groceryQuery.data ?? []), [groceryQuery.data])

  if (
    recipesQuery.isError ||
    scheduleQuery.isError ||
    groceryQuery.isError ||
    mealPrepQuery.isError ||
    planWeekQuery.isError
  ) {
    return (
      <main className="flex-1 p-8 overflow-auto">
        <ErrorState
          onRetry={() => {
            recipesQuery.refetch()
            scheduleQuery.refetch()
            groceryQuery.refetch()
            mealPrepQuery.refetch()
            planWeekQuery.refetch()
          }}
        />
      </main>
    )
  }

  const recipeDetails = detailRecipeId ? recipeDetailsQuery.data : null

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl space-y-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Food</h1>
          <p className="text-sm text-muted-foreground">
            A cohesive workspace for recipes, weekly planning, grocery prep, and cooked history.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ChefHat className="h-4 w-4 text-primary" /> Recipe library
                </CardTitle>
                <Button size="sm" onClick={handleOpenCreate} className="gap-2">
                  <Plus className="h-4 w-4" /> New recipe
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search recipes"
                    value={recipeSearch}
                    onChange={(event) => setRecipeSearch(event.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <Select value={tagFilter} onValueChange={setTagFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tags</SelectItem>
                      {tagOptions.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={cuisineFilter} onValueChange={setCuisineFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Cuisine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All cuisine</SelectItem>
                      {cuisineOptions.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All difficulty</SelectItem>
                      {difficultyOptions.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={timeFilter} onValueChange={setTimeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="quick">Quick (≤20m)</SelectItem>
                      <SelectItem value="medium">Medium (20-45m)</SelectItem>
                      <SelectItem value="long">Slow (45m+)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Recent</SelectItem>
                      <SelectItem value="last_cooked">Last cooked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant={favoritesOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFavoritesOnly((prev) => !prev)}
                  >
                    Favorites
                  </Button>
                  <p className="text-xs text-muted-foreground">{filteredRecipes.length} recipes</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recipesQuery.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-28 w-full" />
                  ))}
                </div>
              ) : filteredRecipes.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRecipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      type="button"
                      onClick={() => setDetailRecipeId(recipe.id)}
                      className="rounded-2xl border border-border p-4 text-left hover:border-primary/40 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                            {recipe.emoji || "🍽️"}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{recipe.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {recipe.cook_time_min ? `${recipe.cook_time_min} min` : "Quick"} · {recipe.servings} servings
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">{formatMacro(recipe.macros_kcal)} kcal</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(recipe.tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag} className="text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded-full">
                            {tag}
                          </span>
                        ))}
                        {recipe.tags?.length > 3 && (
                          <span className="text-[11px] text-muted-foreground">+{recipe.tags.length - 3}</span>
                        )}
                      </div>
                      {lastCookedByRecipe.get(recipe.id) && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Last cooked {format(parseISO(lastCookedByRecipe.get(recipe.id) ?? ""), "MMM d")}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-2xl p-6 text-sm text-muted-foreground">
                  No recipes yet. Add your first recipe or adjust filters.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-4 w-4 text-primary" /> This week
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}
                </span>
              </CardHeader>
              <CardContent className="space-y-4">
                {scheduleQuery.isLoading || planWeekQuery.isLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <div className="space-y-3">
                    {Array.from({ length: 7 }).map((_, index) => {
                      const day = addDays(weekStart, index)
                      const dateKey = format(day, "yyyy-MM-dd")
                      return (
                        <div key={dateKey} className="rounded-xl border border-border p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">{format(day, "EEE, MMM d")}</p>
                            {isSameDay(day, today) && (
                              <span className="text-xs text-primary">Today</span>
                            )}
                          </div>
                          <div className="space-y-2">
                            {mealSlots.map((slot) => {
                              const scheduled = scheduleByDate.get(dateKey)?.find((item) => item.slot === slot.slot) ?? null
                              const planMeal = planMealsByKey.get(buildPlannerKey(dateKey, slot.slot)) ?? null
                              const hasRecipe = Boolean(scheduled?.recipe_id)
                              const hasAiMeal = Boolean(planMeal)
                              return (
                                <button
                                  key={slot.slot}
                                  type="button"
                                  onClick={() => handlePlannerOpen(dateKey, slot.slot, scheduled?.recipe_id)}
                                  className="flex items-center justify-between w-full rounded-lg border border-border px-3 py-2 text-left hover:border-primary/40"
                                >
                                  <div>
                                    <p className="text-xs text-muted-foreground">{slot.label}</p>
                                    <p className="text-sm text-foreground">
                                      {hasAiMeal ? planMeal?.name : scheduled?.name ?? "Plan a meal"}
                                    </p>
                                    {hasAiMeal && (
                                      <p className="text-[11px] text-muted-foreground">
                                        AI meal{hasRecipe ? " · Recipe planned" : ""}
                                      </p>
                                    )}
                                    {!hasAiMeal && hasRecipe && (
                                      <p className="text-[11px] text-muted-foreground">Recipe planned</p>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-muted-foreground">
                                    {formatMacro(planMeal?.kcal ?? scheduled?.kcal)} kcal
                                  </span>
                                </button>
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

            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingBasket className="h-4 w-4 text-primary" /> Grocery list
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => setGroceryModalOpen(true)}>
                  View list
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input type="date" value={groceryStart} onChange={(event) => setGroceryStart(event.target.value)} />
                  <Input type="date" value={groceryEnd} onChange={(event) => setGroceryEnd(event.target.value)} />
                </div>
                <Button variant="outline" size="sm" onClick={handleGenerateGrocery}>
                  Generate list
                </Button>
                {groceryQuery.isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : groceryQuery.data?.length ? (
                  <div className="space-y-2">
                    {(groceryQuery.data ?? []).slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className={item.is_bought ? "line-through text-muted-foreground" : "text-foreground"}>
                          {item.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{item.category ?? "other"}</span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      {groceryQuery.data.length} items · {groceryQuery.data.filter((item) => item.is_bought).length} bought
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No items yet. Generate a list for the week.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Soup className="h-4 w-4 text-primary" /> Cooked history
              </CardTitle>
              <span className="text-xs text-muted-foreground">Last 14 days</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {mealLogRangeQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : cookedHistory.length ? (
                cookedHistory.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => entry.recipeId && setDetailRecipeId(entry.recipeId)}
                    className="w-full rounded-xl border border-border px-4 py-3 text-left hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{entry.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(entry.date), "MMM d")} · {mealSlots.find((slot) => slot.slot === entry.slot)?.label}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatMacro(entry.macros.kcal)} kcal</span>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      P{formatMacro(entry.macros.protein)} C{formatMacro(entry.macros.carbs)} F{formatMacro(entry.macros.fat)}
                    </p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No cooked meals logged yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <NotebookPen className="h-4 w-4 text-primary" /> Meal prep sessions
              </CardTitle>
              <span className="text-xs text-muted-foreground">{mealPrepQuery.data?.length ?? 0} sessions</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {mealPrepQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : mealPrepQuery.data?.length ? (
                mealPrepQuery.data.slice(0, 4).map((session) => (
                  <div key={session.id} className="rounded-xl border border-border px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{session.title}</p>
                      <span className="text-xs text-muted-foreground">
                        {session.session_date ? format(new Date(session.session_date), "MMM d") : "Flexible"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
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

      <CenteredModal open={recipeModalOpen} onOpenChange={setRecipeModalOpen} title={recipeModalMode === "create" ? "Create recipe" : "Edit recipe"}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              type="number"
              min={0}
              placeholder="Cook time (min)"
              value={recipeForm.cook_time_min}
              onChange={(event) => setRecipeForm((prev) => ({ ...prev, cook_time_min: Number(event.target.value) }))}
            />
            <Select
              value={recipeForm.category}
              onValueChange={(value) => setRecipeForm((prev) => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No category</SelectItem>
                {recipeCategories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Tags (comma-separated)"
              value={recipeForm.tags}
              onChange={(event) => setRecipeForm((prev) => ({ ...prev, tags: event.target.value }))}
            />
          </div>
          <Textarea
            placeholder="Notes / description"
            value={recipeForm.description}
            onChange={(event) => setRecipeForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input
              type="number"
              placeholder="kcal"
              value={recipeForm.macros_kcal}
              onChange={(event) => setRecipeForm((prev) => ({ ...prev, macros_kcal: Number(event.target.value) }))}
            />
            <Input
              type="number"
              placeholder="Protein g"
              value={recipeForm.macros_protein_g}
              onChange={(event) => setRecipeForm((prev) => ({ ...prev, macros_protein_g: Number(event.target.value) }))}
            />
            <Input
              type="number"
              placeholder="Carbs g"
              value={recipeForm.macros_carbs_g}
              onChange={(event) => setRecipeForm((prev) => ({ ...prev, macros_carbs_g: Number(event.target.value) }))}
            />
            <Input
              type="number"
              placeholder="Fat g"
              value={recipeForm.macros_fat_g}
              onChange={(event) => setRecipeForm((prev) => ({ ...prev, macros_fat_g: Number(event.target.value) }))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Ingredients</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setRecipeForm((prev) => ({
                    ...prev,
                    ingredients: [
                      ...prev.ingredients,
                      { id: createId(), name: "", quantity: "", unit: "", category: "", optional: false },
                    ],
                  }))
                }
                type="button"
              >
                Add ingredient
              </Button>
            </div>
            <div className="space-y-2">
              {recipeForm.ingredients.map((ingredient, index) => (
                <div key={ingredient.id} className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <Input
                    placeholder="Ingredient"
                    value={ingredient.name}
                    onChange={(event) =>
                      setRecipeForm((prev) => {
                        const next = [...prev.ingredients]
                        next[index] = { ...ingredient, name: event.target.value }
                        return { ...prev, ingredients: next }
                      })
                    }
                  />
                  <Input
                    placeholder="Qty"
                    value={ingredient.quantity}
                    onChange={(event) =>
                      setRecipeForm((prev) => {
                        const next = [...prev.ingredients]
                        next[index] = { ...ingredient, quantity: event.target.value }
                        return { ...prev, ingredients: next }
                      })
                    }
                  />
                  <Input
                    placeholder="Unit"
                    value={ingredient.unit}
                    onChange={(event) =>
                      setRecipeForm((prev) => {
                        const next = [...prev.ingredients]
                        next[index] = { ...ingredient, unit: event.target.value }
                        return { ...prev, ingredients: next }
                      })
                    }
                  />
                  <Select
                    value={ingredient.category}
                    onValueChange={(value) =>
                      setRecipeForm((prev) => {
                        const next = [...prev.ingredients]
                        next[index] = { ...ingredient, category: value }
                        return { ...prev, ingredients: next }
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {groceryCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={ingredient.optional}
                        onChange={(event) =>
                          setRecipeForm((prev) => {
                            const next = [...prev.ingredients]
                            next[index] = { ...ingredient, optional: event.target.checked }
                            return { ...prev, ingredients: next }
                          })
                        }
                      />{" "}
                      Optional
                    </label>
                    {recipeForm.ingredients.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setRecipeForm((prev) => ({
                            ...prev,
                            ingredients: prev.ingredients.filter((item) => item.id !== ingredient.id),
                          }))
                        }
                        type="button"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Steps</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setRecipeForm((prev) => ({
                    ...prev,
                    steps: [...prev.steps, { id: createId(), instruction: "", timer: "" }],
                  }))
                }
                type="button"
              >
                Add step
              </Button>
            </div>
            <div className="space-y-2">
              {recipeForm.steps.map((step, index) => (
                <div key={step.id} className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <Textarea
                    className="md:col-span-3"
                    placeholder={`Step ${index + 1}`}
                    value={step.instruction}
                    onChange={(event) =>
                      setRecipeForm((prev) => {
                        const next = [...prev.steps]
                        next[index] = { ...step, instruction: event.target.value }
                        return { ...prev, steps: next }
                      })
                    }
                  />
                  <Input
                    placeholder="Timer (min)"
                    value={step.timer}
                    onChange={(event) =>
                      setRecipeForm((prev) => {
                        const next = [...prev.steps]
                        next[index] = { ...step, timer: event.target.value }
                        return { ...prev, steps: next }
                      })
                    }
                  />
                  {recipeForm.steps.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setRecipeForm((prev) => ({
                          ...prev,
                          steps: prev.steps.filter((item) => item.id !== step.id),
                        }))
                      }
                      type="button"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSaveRecipe} className="w-full">
            Save recipe
          </Button>
        </div>
      </CenteredModal>

      <CenteredModal
        open={Boolean(detailRecipeId)}
        onOpenChange={(open) => {
          if (!open) setDetailRecipeId(null)
        }}
        title={recipeDetails?.recipe?.title ?? "Recipe"}
        description={recipeDetails?.recipe?.description ?? undefined}
      >
        {recipeDetailsQuery.isFetching ? (
          <Skeleton className="h-32 w-full" />
        ) : recipeDetails?.recipe ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>{recipeDetails.recipe.servings} servings</span>
              <span>{recipeDetails.recipe.cook_time_min ?? 0} min</span>
              <span>{formatMacro(recipeDetails.recipe.macros_kcal)} kcal</span>
              <span>P{formatMacro(recipeDetails.recipe.macros_protein_g)}</span>
              <span>C{formatMacro(recipeDetails.recipe.macros_carbs_g)}</span>
              <span>F{formatMacro(recipeDetails.recipe.macros_fat_g)}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Ingredients</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {recipeDetails.ingredients.map((ingredient) => (
                    <li key={ingredient.id} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary/50" />
                      <span>{formatIngredient(ingredient)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Steps</p>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  {recipeDetails.steps.map((step) => (
                    <li key={step.id} className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground">{step.step_number}.</span>
                      <span>{step.instruction}</span>
                      {step.timer_seconds ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {Math.round(step.timer_seconds / 60)}m
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setCookModeOpen(true)} className="gap-2">
                <Flame className="h-4 w-4" /> Cook
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPlannerSelection({ date: startDate, slot: 1 })
                  setPlannerRecipeId(recipeDetails.recipe.id)
                  setPlannerModalOpen(true)
                }}
              >
                Add to plan
              </Button>
              <Button variant="outline" onClick={() => handleAddRecipeToGrocery(recipeDetails.ingredients)}>
                Add ingredients to grocery list
              </Button>
              <Button
                variant="outline"
                onClick={() => handleOpenEdit(recipeDetails.recipe, recipeDetails.ingredients, recipeDetails.steps)}
              >
                Edit
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Recipe details unavailable.</p>
        )}
      </CenteredModal>

      <CenteredModal open={cookModeOpen} onOpenChange={setCookModeOpen} title="Cook mode">
        {recipeDetails?.steps?.length ? (
          <CookMode steps={recipeDetails.steps} />
        ) : (
          <p className="text-sm text-muted-foreground">No steps available.</p>
        )}
      </CenteredModal>

      <CenteredModal open={plannerModalOpen} onOpenChange={setPlannerModalOpen} title="Plan a meal">
        {plannerSelection ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{format(parseISO(plannerSelection.date), "MMM d, yyyy")}</span>
              <span>{mealSlots.find((slot) => slot.slot === plannerSelection.slot)?.label}</span>
            </div>
            {planMealsByKey.get(buildPlannerKey(plannerSelection.date, plannerSelection.slot)) ? (
              <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
                AI meal: {planMealsByKey.get(buildPlannerKey(plannerSelection.date, plannerSelection.slot))?.name}
              </div>
            ) : null}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipes"
                value={slotSearch}
                onChange={(event) => setSlotSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {(recipesQuery.data ?? [])
                .filter((recipe) => recipe.title.toLowerCase().includes(slotSearch.toLowerCase()))
                .map((recipe) => (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => setPlannerRecipeId(recipe.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left ${
                      plannerRecipeId === recipe.id ? "border-primary" : "border-border"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">{recipe.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {recipe.cook_time_min ?? 0} min · {formatMacro(recipe.macros_kcal)} kcal
                    </p>
                  </button>
                ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  handleAssignRecipe(plannerSelection.date, plannerSelection.slot, null)
                  setPlannerModalOpen(false)
                }}
              >
                Clear recipe
              </Button>
              <Button
                onClick={() => {
                  handleAssignRecipe(plannerSelection.date, plannerSelection.slot, plannerRecipeId)
                  setPlannerModalOpen(false)
                }}
                disabled={!plannerRecipeId}
              >
                Save
              </Button>
            </div>
          </div>
        ) : null}
      </CenteredModal>

      <CenteredModal open={groceryModalOpen} onOpenChange={setGroceryModalOpen} title="Grocery list">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <Input type="date" value={groceryStart} onChange={(event) => setGroceryStart(event.target.value)} />
            <Input type="date" value={groceryEnd} onChange={(event) => setGroceryEnd(event.target.value)} />
            <Button variant="outline" onClick={handleGenerateGrocery}>
              Generate
            </Button>
            <Button variant="outline" onClick={handleExportPdf}>
              Export PDF
            </Button>
          </div>

          {groceryQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : groceryQuery.data?.length ? (
            <div className="space-y-4">
              {Array.from(groupedGroceries.entries()).map(([category, items]) => (
                <div key={category} className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground capitalize">{category}</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => items.forEach((item) => handleToggleBought(item, true))}
                      >
                        Mark all
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => items.forEach((item) => handleToggleBought(item, false))}
                      >
                        Clear bought
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="grid grid-cols-1 md:grid-cols-7 gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => handleToggleBought(item)}
                          className="flex items-center gap-2 text-left"
                        >
                          <span
                            className={`h-3 w-3 rounded-full border ${
                              item.is_bought ? "bg-primary border-primary" : "border-muted-foreground"
                            }`}
                          />
                          <span className={item.is_bought ? "line-through text-muted-foreground" : "text-foreground"}>
                            {item.name}
                          </span>
                        </button>
                        <Input
                          placeholder="Qty"
                          defaultValue={item.quantity ?? ""}
                          onBlur={(event) =>
                            handleUpdateGroceryItem(item, {
                              quantity: event.target.value ? Number(event.target.value) : null,
                            })
                          }
                        />
                        <Input
                          placeholder="Unit"
                          defaultValue={item.unit ?? ""}
                          onBlur={(event) => handleUpdateGroceryItem(item, { unit: event.target.value })}
                        />
                        <Select
                          value={item.category ?? "other"}
                          onValueChange={(value) => handleUpdateGroceryItem(item, { category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {groceryCategories.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Notes"
                          defaultValue={item.notes ?? ""}
                          onBlur={(event) => handleUpdateGroceryItem(item, { notes: event.target.value })}
                        />
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteGroceryItem(item.id)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No items for this range yet.</p>
          )}

          <div className="rounded-xl border border-border p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Add custom item</p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <Input
                placeholder="Item"
                value={groceryDraft.name}
                onChange={(event) => setGroceryDraft((prev) => ({ ...prev, name: event.target.value }))}
              />
              <Input
                placeholder="Qty"
                value={groceryDraft.quantity}
                onChange={(event) => setGroceryDraft((prev) => ({ ...prev, quantity: event.target.value }))}
              />
              <Input
                placeholder="Unit"
                value={groceryDraft.unit}
                onChange={(event) => setGroceryDraft((prev) => ({ ...prev, unit: event.target.value }))}
              />
              <Select
                value={groceryDraft.category}
                onValueChange={(value) => setGroceryDraft((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groceryCategories.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Notes"
                value={groceryDraft.notes}
                onChange={(event) => setGroceryDraft((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
            <Button onClick={handleAddGroceryItem} disabled={groceryBusy}>
              Add item
            </Button>
          </div>
        </div>
      </CenteredModal>
    </main>
  )
}

function CookMode({ steps }: { steps: RecipeStep[] }) {
  const [index, setIndex] = useState(0)
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set())
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  const step = steps[index]

  useEffect(() => {
    if (!step?.timer_seconds) {
      setSecondsLeft(null)
      return
    }
    setSecondsLeft(step.timer_seconds)
  }, [step])

  useEffect(() => {
    if (secondsLeft === null) return
    if (secondsLeft <= 0) return
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => (prev ? prev - 1 : prev))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [secondsLeft])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Step {index + 1} of {steps.length}
        </p>
        {step?.timer_seconds ? (
          <span className="text-xs text-muted-foreground">Timer: {Math.ceil((secondsLeft ?? 0) / 60)}m</span>
        ) : null}
      </div>
      <div className="rounded-xl border border-border p-4">
        <p className="text-sm text-foreground">{step?.instruction}</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={step?.id ? doneSteps.has(step.id) : false}
          onChange={() =>
            setDoneSteps((prev) => {
              const next = new Set(prev)
              if (step?.id) {
                if (next.has(step.id)) {
                  next.delete(step.id)
                } else {
                  next.add(step.id)
                }
              }
              return next
            })
          }
        />
        Mark step as done
      </label>
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setIndex((prev) => Math.max(prev - 1, 0))}>
          Previous
        </Button>
        <Button onClick={() => setIndex((prev) => Math.min(prev + 1, steps.length - 1))}>
          Next
        </Button>
      </div>
    </div>
  )
}

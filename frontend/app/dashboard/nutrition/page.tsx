"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addDays, addWeeks, endOfWeek, format, startOfWeek } from "date-fns"
import { CalendarDays, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { MealCards } from "@/components/dashboard/nutrition/meal-cards"
import { WeeklyCaloriesChart } from "@/components/dashboard/nutrition/weekly-calories-chart"
import { DailyMacroCards } from "@/components/dashboard/nutrition/daily-macro-cards"
import { NutritionChatDrawer } from "@/components/dashboard/nutrition/nutrition-chat-drawer"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/use-toast"
import {
  useMealPlanDay,
  useMacrosDay,
  usePlanChat,
  useProfile,
  useSendPlanChatMessage,
  useTrainingSessions,
  useUpdateNutritionDay,
  useUpdateMealPlanItem,
  useWeeklyNutrition,
} from "@/lib/db/hooks"
import type { MealPlanItem } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"
import { ensureNutritionPlanRange } from "@/lib/nutrition/ensure"
import { useDashboardDate } from "@/components/dashboard/dashboard-date-context"

export default function NutritionPage() {
  const { user } = useSession()
  const { toast } = useToast()
  const { selectedDate, setSelectedDate, nextDay, prevDay } = useDashboardDate()
  const [search, setSearch] = useState("")
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [chatMeal, setChatMeal] = useState<MealPlanItem | null>(null)
  const [pendingDiff, setPendingDiff] = useState<Record<string, unknown> | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editMacros, setEditMacros] = useState(() => ({
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
  }))
  const [editMeals, setEditMeals] = useState<Array<{
    slot: number
    name: string
    time: string | null
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    locked?: boolean
  }>>([])
  const [dayLocked, setDayLocked] = useState(false)
  const queryClient = useQueryClient()

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekStartKey = format(weekStart, "yyyy-MM-dd")
  const weekEndKey = format(weekEnd, "yyyy-MM-dd")
  const selectedDateKey = format(selectedDate, "yyyy-MM-dd")
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`
  const weekDayOffset = (selectedDate.getDay() + 6) % 7

  const profileQuery = useProfile(user?.id)
  const weeklyNutritionQuery = useWeeklyNutrition(user?.id, weekStartKey, weekEndKey)
  const mealPlanQuery = useMealPlanDay(user?.id, selectedDateKey)
  const macrosQuery = useMacrosDay(user?.id, selectedDateKey)
  const trainingWeekQuery = useTrainingSessions(user?.id, weekStartKey, weekEndKey)
  const updateMealMutation = useUpdateMealPlanItem()
  const updateNutritionDay = useUpdateNutritionDay(user?.id)
  const chatQuery = usePlanChat(user?.id, weekStartKey, weekEndKey)
  const sendChatMutation = useSendPlanChatMessage(user?.id, weekStartKey, weekEndKey)
  const planEnsureRef = useRef<string | null>(null)
  const fuelEnsureRef = useRef<string | null>(null)

  const autoGenerateMutation = useMutation({
    mutationFn: () => ensureNutritionPlanRange({ start: weekStartKey, end: weekEndKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["db", "nutrition-week", user?.id] })
      queryClient.invalidateQueries({ queryKey: ["db", "meal-plan-day", user?.id] })
      queryClient.invalidateQueries({ queryKey: ["db", "macros-day", user?.id] })
    },
    onError: (error) => {
      planEnsureRef.current = null
      toast({
        title: "Nutrition update failed",
        description: error instanceof Error ? error.message : "Unable to update nutrition plan.",
        variant: "destructive",
      })
    },
  })

  const fuelEnsureMutation = useMutation({
    mutationFn: async (date: string) => {
      const response = await fetch("/api/v1/nutrition/fuel/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Failed to update fueling")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["db", "meal-plan-day", user?.id, selectedDateKey] })
      queryClient.invalidateQueries({ queryKey: ["db", "macros-day", user?.id, selectedDateKey] })
      queryClient.invalidateQueries({ queryKey: ["db", "nutrition-week", user?.id] })
    },
  })

  const selectedDay = (weeklyNutritionQuery.data ?? []).find((day) => day.date === selectedDateKey) ?? {
    date: selectedDateKey,
    consumed: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, intra_cho_g_per_h: 0 },
    target: null,
    locked: false,
  }

  const dayType = useMemo(() => {
    const sessions = trainingWeekQuery.data ?? []
    const hasTraining = sessions.some((session) => session.date === selectedDateKey)
    return hasTraining ? "Training day" : "Rest day"
  }, [selectedDateKey, trainingWeekQuery.data])

  const carbNote = dayType === "Training day"
    ? "Carbs are higher today to fuel training sessions and recovery."
    : "Carbs ease off to match recovery needs on rest days."

  const workoutsForDay = useMemo(() => {
    return (trainingWeekQuery.data ?? []).filter((session) => session.date === selectedDateKey)
  }, [selectedDateKey, trainingWeekQuery.data])

  useEffect(() => {
    if (!user?.id || weeklyNutritionQuery.isLoading || trainingWeekQuery.isLoading) return
    const workouts = trainingWeekQuery.data ?? []
    if (workouts.length === 0) return
    const missingTargets = (weeklyNutritionQuery.data ?? []).some((day) => !day.target)
    if (!missingTargets) return
    const rangeKey = `${user.id}:${weekStartKey}:${weekEndKey}`
    if (planEnsureRef.current === rangeKey || autoGenerateMutation.isPending) return
    planEnsureRef.current = rangeKey
    autoGenerateMutation.mutate()
  }, [autoGenerateMutation, trainingWeekQuery.data, trainingWeekQuery.isLoading, user?.id, weekEndKey, weekStartKey, weeklyNutritionQuery.data, weeklyNutritionQuery.isLoading])

  useEffect(() => {
    if (!user?.id || trainingWeekQuery.isLoading) return
    const key = `${user.id}:${selectedDateKey}`
    if (fuelEnsureRef.current === key || fuelEnsureMutation.isPending) return
    fuelEnsureRef.current = key
    fuelEnsureMutation.mutate(selectedDateKey)
  }, [fuelEnsureMutation, selectedDateKey, trainingWeekQuery.isLoading, user?.id])

  useEffect(() => {
    if (!editOpen) return
    const macros = selectedDay.target ?? { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, intra_cho_g_per_h: 0 }
    setEditMacros({
      kcal: macros.kcal ?? 0,
      protein_g: macros.protein_g ?? 0,
      carbs_g: macros.carbs_g ?? 0,
      fat_g: macros.fat_g ?? 0,
    })
    setDayLocked(Boolean((weeklyNutritionQuery.data ?? []).find((day) => day.date === selectedDateKey)?.locked))
    const items = (mealPlanQuery.data?.items ?? []).map((item) => ({
      slot: item.slot,
      name: item.name,
      time: item.time ?? null,
      kcal: item.kcal ?? 0,
      protein_g: item.protein_g ?? 0,
      carbs_g: item.carbs_g ?? 0,
      fat_g: item.fat_g ?? 0,
      locked: item.locked ?? false,
    }))
    setEditMeals(items)
  }, [editOpen, mealPlanQuery.data?.items, selectedDateKey, selectedDay.target, weeklyNutritionQuery.data])

  useEffect(() => {
    if (!chatOpen) {
      setChatMeal(null)
      setPendingDiff(null)
    }
  }, [chatOpen])

  const handleAddMeal = () => {
    setEditMeals((prev) => {
      const nextSlot = prev.length > 0 ? Math.max(...prev.map((meal) => meal.slot)) + 1 : 1
      return [
        ...prev,
        {
          slot: nextSlot,
          name: `Meal ${nextSlot}`,
          time: null,
          kcal: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          locked: false,
        },
      ]
    })
  }

  const handleRemoveMeal = (slot: number) => {
    setEditMeals((prev) => prev.filter((meal) => meal.slot !== slot))
  }

  const handleSaveEdits = async () => {
    try {
      await updateNutritionDay.mutateAsync({
        date: selectedDateKey,
        macros: editMacros,
        meals: editMeals,
        removedSlots: (mealPlanQuery.data?.items ?? [])
          .map((item) => item.slot)
          .filter((slot) => !editMeals.some((meal) => meal.slot === slot)),
        day_locked: dayLocked,
      })
      toast({ title: "Day updated", description: "Your edits have been saved." })
      setEditOpen(false)
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save changes.",
        variant: "destructive",
      })
    }
  }

  const handleSendChat = async () => {
    if (!chatInput.trim()) return
    const macros = macrosQuery.data
    const meals = mealPlanQuery.data?.items ?? []
    const mealIngredients = chatMeal?.ingredients
      ? (Array.isArray(chatMeal.ingredients) ? chatMeal.ingredients : [])
          .map((item) => {
            if (typeof item === "string") return item
            if (item && typeof item === "object") {
              const record = item as { name?: string; quantity?: string; amount?: string }
              return `${record.name ?? "Ingredient"}${record.quantity ? ` (${record.quantity})` : record.amount ? ` (${record.amount})` : ""}`
            }
            return null
          })
          .filter(Boolean)
          .join(", ")
      : ""
    const recipeSteps = chatMeal?.recipe && typeof chatMeal.recipe === "object"
      ? Array.isArray((chatMeal.recipe as { steps?: unknown }).steps)
        ? ((chatMeal.recipe as { steps?: unknown }).steps as unknown[]).filter((step) => typeof step === "string").join(" | ")
        : ""
      : ""
    const mealContext = chatMeal
      ? [
          `Focused meal: ${chatMeal.name} (${chatMeal.kcal} kcal, P ${chatMeal.protein_g}g, C ${chatMeal.carbs_g}g, F ${chatMeal.fat_g}g).`,
          mealIngredients ? `Ingredients: ${mealIngredients}` : "",
          recipeSteps ? `Steps: ${recipeSteps}` : "",
        ]
          .filter(Boolean)
          .join(" ")
      : ""
    const workoutsSummary = workoutsForDay.length
      ? workoutsForDay.map((workout) => `${workout.title} (${workout.durationMinutes}m, ${workout.intensity})`).join("; ")
      : "No workouts"
    const mealsSummary = meals.length
      ? meals.map((meal) => `${meal.name} (${meal.kcal} kcal)`).join("; ")
      : "No meals"

    const contextMessage = [
      `Date: ${selectedDateKey}`,
      `Workouts: ${workoutsSummary}`,
      macros?.target
        ? `Targets: ${macros.target.kcal} kcal, P ${macros.target.protein_g}g, C ${macros.target.carbs_g}g, F ${macros.target.fat_g}g`
        : "Targets: none",
      `Consumed: ${macros?.consumed.kcal ?? 0} kcal, P ${macros?.consumed.protein_g ?? 0}g, C ${macros?.consumed.carbs_g ?? 0}g, F ${macros?.consumed.fat_g ?? 0}g`,
      `Meals: ${mealsSummary}`,
      mealContext,
    ]
      .filter(Boolean)
      .join("\n")

    try {
      const response = (await sendChatMutation.mutateAsync(
        `Context:\n${contextMessage}\n\nUser request: ${chatInput.trim()}`,
      )) as { diff?: Record<string, unknown> }
      if (response?.diff) {
        setPendingDiff(response.diff)
      }
      setChatInput("")
      setChatMeal(null)
    } catch (error) {
      toast({
        title: "Message failed",
        description: error instanceof Error ? error.message : "Unable to send message.",
        variant: "destructive",
      })
    }
  }

  const handleApplyChatUpdates = () => {
    queryClient.invalidateQueries({ queryKey: ["db", "meal-plan-day", user?.id] })
    queryClient.invalidateQueries({ queryKey: ["db", "nutrition-week", user?.id] })
    queryClient.invalidateQueries({ queryKey: ["db", "macros-day", user?.id] })
    setPendingDiff(null)
    toast({ title: "Updates applied", description: "Your nutrition plan has been refreshed." })
  }

  if (weeklyNutritionQuery.isError || macrosQuery.isError || mealPlanQuery.isError) {
    return (
      <ErrorState
        onRetry={() => {
          weeklyNutritionQuery.refetch()
          macrosQuery.refetch()
          mealPlanQuery.refetch()
        }}
      />
    )
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Nutrition</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full px-4 text-xs"
              onClick={() => {
                const nextWeekStart = startOfWeek(addWeeks(selectedDate, -1), { weekStartsOn: 1 })
                setSelectedDate(addDays(nextWeekStart, weekDayOffset))
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev week
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-4 text-xs"
              onClick={() => {
                const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
                setSelectedDate(addDays(currentWeekStart, weekDayOffset))
              }}
            >
              This week
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-4 text-xs"
              onClick={() => {
                const nextWeekStart = startOfWeek(addWeeks(selectedDate, 1), { weekStartsOn: 1 })
                setSelectedDate(addDays(nextWeekStart, weekDayOffset))
              }}
            >
              Next week <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <span className="text-sm text-muted-foreground">{weekLabel}</span>
          </div>
        </div>

        {profileQuery.data && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
              <span className="text-2xl">🥗</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nutrition plan for</p>
              <p className="font-semibold text-foreground">
                {profileQuery.data.full_name || profileQuery.data.name || "Athlete"}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <DailyMacroCards
            consumed={macrosQuery.data?.consumed ?? selectedDay.consumed}
            target={macrosQuery.data?.target ?? selectedDay.target}
            isLoading={macrosQuery.isLoading || weeklyNutritionQuery.isLoading}
          />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Meals</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="rounded-full px-3 text-xs">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  {format(selectedDate, "EEE, MMM d")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={nextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search meals"
              className="h-9 rounded-full border border-border bg-transparent px-4 text-xs text-muted-foreground"
            />
            <Button
              onClick={() => setEditOpen(true)}
              variant="outline"
              className="h-9 rounded-full px-4 text-xs"
              type="button"
            >
              Edit day
            </Button>
            <Button
              variant="outline"
              className="h-9 rounded-full px-3 text-xs"
              onClick={() => {
                setChatOpen(true)
                setChatMeal(null)
              }}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Open chat
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <WeeklyCaloriesChart
            days={weeklyNutritionQuery.data ?? []}
            selectedDate={selectedDateKey}
            isLoading={weeklyNutritionQuery.isLoading}
            onSelectDate={(date) => setSelectedDate(new Date(`${date}T00:00:00`))}
          />
          <MealCards
            mealPlan={mealPlanQuery.data ?? null}
            target={macrosQuery.data?.target ?? selectedDay.target}
            selectedDate={selectedDateKey}
            search={search}
            isLoading={mealPlanQuery.isLoading || weeklyNutritionQuery.isLoading}
            isUpdating={updateMealMutation.isPending}
            dayTypeLabel={dayType}
            dayTypeNote={carbNote}
            onToggleMeal={(mealId, eaten) => updateMealMutation.mutate({ id: mealId, payload: { eaten } })}
            onAdaptMeal={(meal) => {
              setChatMeal(meal)
              setChatOpen(true)
            }}
          />
        </div>
      </div>

      <NutritionChatDrawer
        open={chatOpen}
        onOpenChange={setChatOpen}
        weekLabel={weekLabel}
        isLoading={chatQuery.isLoading}
        messages={chatQuery.data?.messages ?? []}
        input={chatInput}
        onInputChange={setChatInput}
        onSend={handleSendChat}
        isSending={sendChatMutation.isPending}
        pendingDiff={pendingDiff}
        onApply={handleApplyChatUpdates}
      />

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Edit {selectedDateKey}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Lock day</p>
                <p className="text-xs text-muted-foreground">Locked days won&apos;t be changed by regeneration.</p>
              </div>
              <Button
                variant={dayLocked ? "default" : "outline"}
                size="sm"
                onClick={() => setDayLocked((prev) => !prev)}
              >
                {dayLocked ? "Locked" : "Unlocked"}
              </Button>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Macro targets</h3>
              <div className="grid grid-cols-2 gap-3">
                {(["kcal", "protein_g", "carbs_g", "fat_g"] as const).map((key) => (
                  <label key={key} className="text-xs text-muted-foreground flex flex-col gap-1">
                    {key.replace("_g", "").toUpperCase()}
                    <input
                      type="number"
                      value={editMacros[key]}
                      onChange={(event) =>
                        setEditMacros((prev) => ({ ...prev, [key]: Number(event.target.value) }))
                      }
                      className="h-9 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Meals</h3>
                <Button variant="outline" size="sm" onClick={handleAddMeal}>
                  Add meal
                </Button>
              </div>
              <div className="space-y-4">
                {editMeals.map((meal) => (
                  <div key={meal.slot} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Slot {meal.slot}</p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={meal.locked ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setEditMeals((prev) =>
                              prev.map((item) =>
                                item.slot === meal.slot ? { ...item, locked: !item.locked } : item,
                              ),
                            )
                          }
                        >
                          {meal.locked ? "Locked" : "Unlocked"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveMeal(meal.slot)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs text-muted-foreground flex flex-col gap-1">
                        Name
                        <input
                          value={meal.name}
                          onChange={(event) =>
                            setEditMeals((prev) =>
                              prev.map((item) =>
                                item.slot === meal.slot ? { ...item, name: event.target.value } : item,
                              ),
                            )
                          }
                          className="h-9 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
                        />
                      </label>
                      <label className="text-xs text-muted-foreground flex flex-col gap-1">
                        Time
                        <input
                          value={meal.time ?? ""}
                          onChange={(event) =>
                            setEditMeals((prev) =>
                              prev.map((item) =>
                                item.slot === meal.slot ? { ...item, time: event.target.value || null } : item,
                              ),
                            )
                          }
                          placeholder="HH:MM"
                          className="h-9 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
                        />
                      </label>
                      {(["kcal", "protein_g", "carbs_g", "fat_g"] as const).map((key) => (
                        <label key={key} className="text-xs text-muted-foreground flex flex-col gap-1">
                          {key.replace("_g", "").toUpperCase()}
                          <input
                            type="number"
                            value={meal[key]}
                            onChange={(event) =>
                              setEditMeals((prev) =>
                                prev.map((item) =>
                                  item.slot === meal.slot
                                    ? { ...item, [key]: Number(event.target.value) }
                                    : item,
                                ),
                              )
                            }
                            className="h-9 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdits} disabled={updateNutritionDay.isPending}>
                Save changes
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  )
}

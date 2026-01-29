"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addDays, addWeeks, format, isWithinInterval, parseISO, startOfWeek } from "date-fns"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { MealCards } from "@/components/dashboard/nutrition/meal-cards"
import { WeeklyCaloriesChart } from "@/components/dashboard/nutrition/weekly-calories-chart"
import { DailyMacroCards } from "@/components/dashboard/nutrition/daily-macro-cards"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/use-toast"
import {
  useMealPlanDay,
  useProfile,
  useTrainingSessions,
  useUpdateNutritionDay,
  useUpdateMealPlanItem,
  useWeekRange,
  useWeeklyNutrition,
} from "@/lib/db/hooks"
import { useSession } from "@/hooks/use-session"
import { ensureNutritionPlanRange } from "@/lib/nutrition/ensure"

export default function NutritionPage() {
  const { user } = useSession()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const profileQuery = useProfile(user?.id)
  const [search, setSearch] = useState("")
  const [now] = useState(() => new Date())
  const [anchorDate, setAnchorDate] = useState(() => startOfWeek(now, { weekStartsOn: 1 }))
  const [selectedDate, setSelectedDate] = useState(() => format(now, "yyyy-MM-dd"))
  const queryClient = useQueryClient()

  const { start: weekStart, end: weekEnd, startKey: weekStartKey, endKey: weekEndKey } = useWeekRange(anchorDate)
  const weeklyNutritionQuery = useWeeklyNutrition(user?.id, weekStartKey, weekEndKey)
  const mealPlanQuery = useMealPlanDay(user?.id, selectedDate)
  const trainingWeekQuery = useTrainingSessions(user?.id, weekStartKey, weekEndKey)
  const updateMealMutation = useUpdateMealPlanItem()
  const updateNutritionDay = useUpdateNutritionDay(user?.id)
  const lastSyncedRef = useRef<string | null>(null)
  const ensureRef = useRef<string | null>(null)
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

  useEffect(() => {
    if (!selectedDate) return
    const selectedDateObj = parseISO(selectedDate)
    if (!isWithinInterval(selectedDateObj, { start: weekStart, end: weekEnd })) {
      setSelectedDate(format(weekStart, "yyyy-MM-dd"))
    }
  }, [selectedDate, weekStart, weekEnd])

  useEffect(() => {
    if (!selectedDate) return
    const nextAnchor = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 })
    setAnchorDate(nextAnchor)
  }, [selectedDate])

  useEffect(() => {
    const urlDate = searchParams.get("date")
    const urlWeek = searchParams.get("weekStart")
    if (urlDate) {
      setSelectedDate(urlDate)
    }
    if (urlWeek) {
      const parsed = parseISO(urlWeek)
      if (!Number.isNaN(parsed.getTime())) {
        setAnchorDate(startOfWeek(parsed, { weekStartsOn: 1 }))
      }
    }
  }, [searchParams])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("date", selectedDate)
    params.set("weekStart", format(weekStart, "yyyy-MM-dd"))
    const nextQuery = params.toString()
    if (lastSyncedRef.current === nextQuery) return
    lastSyncedRef.current = nextQuery
    if (nextQuery !== searchParams.toString()) {
      router.replace(`/dashboard/nutrition?${nextQuery}`)
    }
  }, [router, searchParams, selectedDate, weekStart])

  if (weeklyNutritionQuery.isError) {
    return <ErrorState onRetry={() => weeklyNutritionQuery.refetch()} />
  }

  const selectedDay = (weeklyNutritionQuery.data ?? []).find((day) => day.date === selectedDate) ?? {
    date: selectedDate,
    consumed: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, intra_cho_g_per_h: 0 },
    target: null,
    locked: false,
  }

  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`

  const dayType = useMemo(() => {
    const sessions = trainingWeekQuery.data ?? []
    const hasTraining = sessions.some((session) => session.date === selectedDate)
    return hasTraining ? "Training day" : "Rest day"
  }, [selectedDate, trainingWeekQuery.data])

  const carbNote = dayType === "Training day"
    ? "Carbs are higher today to fuel training sessions and recovery."
    : "Carbs ease off to match recovery needs on rest days."

  useEffect(() => {
    if (!user?.id || trainingWeekQuery.isLoading) return
    const sessions = trainingWeekQuery.data ?? []
    if (sessions.length === 0) return
    const ensureKey = `${user.id}:${weekStartKey}:${weekEndKey}`
    if (ensureRef.current === ensureKey) return
    ensureRef.current = ensureKey
    ensureNutritionPlanRange({ start: weekStartKey, end: weekEndKey })
      .then(() => {
        weeklyNutritionQuery.refetch()
        mealPlanQuery.refetch()
        queryClient.invalidateQueries({ queryKey: ["db", "plan-week"] })
        queryClient.invalidateQueries({ queryKey: ["db", "calendar-events"] })
      })
      .catch((error) => {
        console.error("Failed to ensure nutrition plan", error)
        toast({
          title: "Nutrition update failed",
          description: error instanceof Error ? error.message : "Unable to update nutrition plan.",
          variant: "destructive",
        })
      })
  }, [
    mealPlanQuery.refetch,
    queryClient,
    toast,
    trainingWeekQuery.data,
    trainingWeekQuery.isLoading,
    user?.id,
    weekEndKey,
    weekStartKey,
    weeklyNutritionQuery.refetch,
  ])

  useEffect(() => {
    if (!editOpen) return
    const macros = selectedDay.target ?? { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, intra_cho_g_per_h: 0 }
    setEditMacros({
      kcal: macros.kcal ?? 0,
      protein_g: macros.protein_g ?? 0,
      carbs_g: macros.carbs_g ?? 0,
      fat_g: macros.fat_g ?? 0,
    })
    setDayLocked(Boolean((weeklyNutritionQuery.data ?? []).find((day) => day.date === selectedDate)?.locked))
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
  }, [editOpen, mealPlanQuery.data?.items, selectedDate, selectedDay.target, weeklyNutritionQuery.data])

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
        date: selectedDate,
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

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Nutrition</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-full px-4 text-xs" onClick={() => setAnchorDate(addWeeks(anchorDate, -1))}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev week
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-4 text-xs"
              onClick={() => setAnchorDate(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            >
              This week
            </Button>
            <Button variant="outline" className="rounded-full px-4 text-xs" onClick={() => setAnchorDate(addWeeks(anchorDate, 1))}>
              Next week <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <span className="text-sm text-muted-foreground">{weekLabel}</span>
          </div>
        </div>

        {/* Training Link Banner */}
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
            consumed={selectedDay.consumed}
            target={selectedDay.target}
            isLoading={weeklyNutritionQuery.isLoading}
          />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Meals</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), -1), "yyyy-MM-dd"))}
              className="rounded-full"
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-9 rounded-full border border-border bg-transparent px-4 text-xs text-muted-foreground"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
              className="rounded-full"
              type="button"
            >
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
              size="icon"
              className="rounded-full"
              type="button"
              onClick={() => router.push(`/dashboard/plans?chat=1&date=${selectedDate}`)}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <WeeklyCaloriesChart
            days={weeklyNutritionQuery.data ?? []}
            selectedDate={selectedDate}
            isLoading={weeklyNutritionQuery.isLoading}
            onSelectDate={setSelectedDate}
          />
          <MealCards
            mealPlan={mealPlanQuery.data ?? null}
            target={selectedDay.target}
            selectedDate={selectedDate}
            search={search}
            isLoading={mealPlanQuery.isLoading || weeklyNutritionQuery.isLoading}
            isUpdating={updateMealMutation.isPending}
            dayTypeLabel={dayType}
            dayTypeNote={carbNote}
            onToggleMeal={(mealId, eaten) => updateMealMutation.mutate({ id: mealId, payload: { eaten } })}
          />
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {selectedDate}</DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </main>
  )
}

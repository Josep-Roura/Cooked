"use client"

import { useMemo, useState } from "react"
import { addWeeks, eachDayOfInterval, endOfWeek, format, startOfWeek } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { WeeklyPlanHeader } from "@/components/dashboard/plans/weekly-plan-header"
import { PlanChatDrawer } from "@/components/dashboard/plans/plan-chat-drawer"
import { useSession } from "@/hooks/use-session"
import { usePlanChat, usePlanWeek, useResetPlanChat, useSendPlanChatMessage, useTrainingSessions, useNutritionPlanRowsRange } from "@/lib/db/hooks"
import { ensureNutritionPlanRange, useEnsureNutritionPlanRange } from "@/lib/nutrition/ensure"
import type { PlanWeekMeal, TrainingSessionSummary } from "@/lib/db/types"
import { getMealEmoji } from "@/lib/utils/mealEmoji"
import { NotionModal } from "@/components/dashboard/schedule/notion-modal"
import { WeeklyTimeGrid } from "@/components/dashboard/schedule/weekly-time-grid"
import type { ScheduleItem } from "@/components/dashboard/schedule/types"
import { clampMinutes, minutesToTime, timeToMinutes } from "@/components/dashboard/schedule/utils"

export default function PlansPage() {
  const { user } = useSession()
  const { toast } = useToast()
  const [anchorDate, setAnchorDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null)

  const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(anchorDate, { weekStartsOn: 1 })
  const weekStartKey = format(weekStart, "yyyy-MM-dd")
  const weekEndKey = format(weekEnd, "yyyy-MM-dd")
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`

  const weekMealsQuery = usePlanWeek(user?.id, weekStartKey, weekEndKey)
  const trainingQuery = useTrainingSessions(user?.id, weekStartKey, weekEndKey)
  const planRowsQuery = useNutritionPlanRowsRange(user?.id, weekStartKey, weekEndKey)
  const chatQuery = usePlanChat(user?.id, weekStartKey, weekEndKey)
  const sendChatMutation = useSendPlanChatMessage(user?.id, weekStartKey, weekEndKey)
  const resetChatMutation = useResetPlanChat(user?.id, weekStartKey, weekEndKey)
  useEnsureNutritionPlanRange({ userId: user?.id, start: weekStartKey, end: weekEndKey, enabled: Boolean(user?.id) })

  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])

  const planRowsByDate = useMemo(() => {
    const map = new Map<string, number>()
    ;(planRowsQuery.data ?? []).forEach((row) => {
      map.set(row.date, row.intra_cho_g_per_h ?? 0)
    })
    return map
  }, [planRowsQuery.data])

  const weeklyTotals = useMemo(() => {
    return (weekMealsQuery.data ?? []).reduce(
      (acc, meal) => {
        acc.kcal += meal.kcal ?? 0
        acc.protein += meal.protein_g ?? 0
        acc.carbs += meal.carbs_g ?? 0
        acc.fat += meal.fat_g ?? 0
        return acc
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    )
  }, [weekMealsQuery.data])

  const handleSendChat = async () => {
    if (!chatInput.trim()) return
    try {
      await sendChatMutation.mutateAsync(chatInput.trim())
      setChatInput("")
    } catch (error) {
      toast({
        title: "Message failed",
        description: error instanceof Error ? error.message : "Unable to send message.",
        variant: "destructive",
      })
    }
  }

  const handleGenerateWeek = async (resetLocks = false, force = true) => {
    setIsGenerating(true)
    try {
      await ensureNutritionPlanRange({ start: weekStartKey, end: weekEndKey, force, resetLocks })
      await weekMealsQuery.refetch()
    } catch (error) {
      toast({
        title: "Plan generation failed",
        description: error instanceof Error ? error.message : "Unable to generate plan.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleResetChat = async () => {
    if (!chatQuery.data?.thread?.id) return
    try {
      await resetChatMutation.mutateAsync(chatQuery.data.thread.id)
      toast({ title: "Chat cleared", description: "This week’s chat has been reset." })
    } catch (error) {
      toast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : "Unable to reset chat.",
        variant: "destructive",
      })
    }
  }

  const handleRegenerateWeek = () => handleGenerateWeek(false, true)
  const handleResetWeek = () => handleGenerateWeek(true, true)

  const defaultMealTime = (meal: PlanWeekMeal) => {
    if (meal.time) return meal.time
    const label = meal.name.toLowerCase()
    if (label.includes("breakfast")) return "07:30"
    if (label.includes("lunch")) return "12:30"
    if (label.includes("dinner")) return "19:00"
    if (label.includes("snack")) return "16:00"
    return "12:00"
  }

  const mealDurationMinutes = (meal: PlanWeekMeal) => {
    const label = meal.name.toLowerCase()
    if (label.includes("snack")) return 20
    if (label.includes("breakfast") || label.includes("lunch") || label.includes("dinner")) return 45
    return 30
  }

  const buildWorkoutItems = (session: TrainingSessionSummary) => {
    const startTime = session.time ?? "18:00"
    const startMinutes = timeToMinutes(startTime)
    const duration = Math.max(session.durationMinutes, 30)
    const endMinutes = startMinutes + duration
    const items: ScheduleItem[] = [
      {
        id: `workout-${session.id}`,
        type: "workout",
        date: session.date,
        startTime,
        endTime: minutesToTime(endMinutes),
        title: session.title,
        emoji: session.type === "run" ? "🏃" : session.type === "bike" ? "🚴" : session.type === "swim" ? "🏊" : "💪",
        meta: { session },
      },
    ]

    const intra = planRowsByDate.get(session.date) ?? 0
    if (intra > 0) {
      items.push(
        {
          id: `workout-pre-${session.id}`,
          type: "nutrition_pre",
          date: session.date,
          startTime: minutesToTime(clampMinutes(startMinutes - 45, 0, 24 * 60)),
          endTime: minutesToTime(clampMinutes(startMinutes - 15, 0, 24 * 60)),
          title: "Pre-fuel",
          emoji: "⚡",
        },
        {
          id: `workout-during-${session.id}`,
          type: "nutrition_during",
          date: session.date,
          startTime,
          endTime: minutesToTime(endMinutes),
          title: "During fuel",
          emoji: "💧",
        },
        {
          id: `workout-post-${session.id}`,
          type: "nutrition_post",
          date: session.date,
          startTime: minutesToTime(clampMinutes(endMinutes, 0, 24 * 60)),
          endTime: minutesToTime(clampMinutes(endMinutes + 30, 0, 24 * 60)),
          title: "Post-fuel",
          emoji: "🥤",
        },
      )
    }

    return items
  }

  const scheduleItems = useMemo(() => {
    const meals = (weekMealsQuery.data ?? []).flatMap((meal) => {
      const startTime = defaultMealTime(meal)
      const startMinutes = timeToMinutes(startTime)
      const duration = mealDurationMinutes(meal)
      return [
        {
          id: `meal-${meal.id}`,
          type: "meal",
          date: meal.date,
          startTime,
          endTime: minutesToTime(startMinutes + duration),
          title: meal.name,
          emoji: meal.emoji ?? getMealEmoji(meal.name, meal.meal_type),
          kcal: meal.kcal,
          protein_g: meal.protein_g,
          carbs_g: meal.carbs_g,
          fat_g: meal.fat_g,
          meta: { meal },
        },
      ] as ScheduleItem[]
    })

    const workouts = (trainingQuery.data ?? []).flatMap((session) => buildWorkoutItems(session))

    return [...meals, ...workouts]
  }, [planRowsByDate, trainingQuery.data, weekMealsQuery.data])

  if (weekMealsQuery.isError || chatQuery.isError || trainingQuery.isError) {
    return <ErrorState onRetry={() => {
      weekMealsQuery.refetch()
      chatQuery.refetch()
    }} />
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl space-y-6">
        <WeeklyPlanHeader
          weekLabel={weekLabel}
          onPrevWeek={() => setAnchorDate(addWeeks(anchorDate, -1))}
          onNextWeek={() => setAnchorDate(addWeeks(anchorDate, 1))}
          onThisWeek={() => setAnchorDate(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          onOpenChat={() => setChatOpen(true)}
          onRegenerateWeek={handleRegenerateWeek}
          onResetWeek={handleResetWeek}
          isGenerating={isGenerating}
        />

        {weekMealsQuery.isLoading || trainingQuery.isLoading ? (
          <Skeleton className="h-[720px] w-full" />
        ) : (weekMealsQuery.data ?? []).length === 0 && (trainingQuery.data ?? []).length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No meals planned for this week yet.</p>
            <Button
              variant="outline"
              className="rounded-full text-xs"
              onClick={() => handleGenerateWeek(false, true)}
              disabled={isGenerating}
            >
              Generate plan
            </Button>
          </div>
        ) : (
          <WeeklyTimeGrid
            days={days}
            items={scheduleItems}
            onSelectItem={(item) => setSelectedItem(item)}
          />
        )}
      </div>

      <div className="sticky bottom-6 mt-8">
        <div className="max-w-6xl mx-auto bg-card border border-border rounded-full px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="text-xs text-muted-foreground">Weekly totals</div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Badge variant="secondary">{weeklyTotals.kcal} kcal</Badge>
            <Badge variant="secondary">P {weeklyTotals.protein}g</Badge>
            <Badge variant="secondary">C {weeklyTotals.carbs}g</Badge>
            <Badge variant="secondary">F {weeklyTotals.fat}g</Badge>
          </div>
        </div>
      </div>

      <NotionModal
        open={Boolean(selectedItem)}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        title={selectedItem?.title ?? "Details"}
      >
        {selectedItem?.type === "meal" && (
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-muted px-2 py-1">{selectedItem.kcal ?? 0} kcal</span>
              <span className="rounded-full bg-muted px-2 py-1">P {selectedItem.protein_g ?? 0}g</span>
              <span className="rounded-full bg-muted px-2 py-1">C {selectedItem.carbs_g ?? 0}g</span>
              <span className="rounded-full bg-muted px-2 py-1">F {selectedItem.fat_g ?? 0}g</span>
            </div>
            {(() => {
              const meal = selectedItem.meta?.meal as PlanWeekMeal | undefined
              if (!meal) return null
              const ingredients = Array.isArray(meal.recipe_ingredients)
                ? meal.recipe_ingredients.map((item) => `${item.name}${item.quantity ? ` · ${item.quantity}` : ""}`)
                : []
              return (
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Ingredients</p>
                  {ingredients.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                      {ingredients.map((ingredient, index) => (
                        <li key={`ingredient-${index}`}>{ingredient}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No ingredients listed yet.</p>
                  )}
                </div>
              )
            })()}
          </div>
        )}
        {selectedItem?.type === "workout" && (
          <div className="space-y-3 text-sm text-muted-foreground">
            {selectedItem.meta?.session && (
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {(selectedItem.meta.session as TrainingSessionSummary).title}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {(selectedItem.meta.session as TrainingSessionSummary).type} ·{" "}
                  {(selectedItem.meta.session as TrainingSessionSummary).durationMinutes} min
                </p>
              </div>
            )}
          </div>
        )}
      </NotionModal>

      <PlanChatDrawer
        open={chatOpen}
        onOpenChange={setChatOpen}
        weekLabel={weekLabel}
        isLoading={chatQuery.isLoading}
        thread={chatQuery.data?.thread ?? null}
        messages={chatQuery.data?.messages ?? []}
        input={chatInput}
        onInputChange={setChatInput}
        onSend={handleSendChat}
        onReset={handleResetChat}
        isSending={sendChatMutation.isPending}
      />
    </main>
  )
}

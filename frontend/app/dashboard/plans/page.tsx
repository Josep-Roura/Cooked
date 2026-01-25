"use client"

import { useMemo, useState } from "react"
import { addWeeks, eachDayOfInterval, endOfWeek, format, startOfWeek } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { DayPlanCard } from "@/components/dashboard/plans/day-plan-card"
import { PlanChatDrawer } from "@/components/dashboard/plans/plan-chat-drawer"
import { PlanDetailsDrawer } from "@/components/dashboard/plans/plan-details-drawer"
import { WeeklyPlanHeader } from "@/components/dashboard/plans/weekly-plan-header"
import { useSession } from "@/hooks/use-session"
import { usePlanChat, usePlanWeek, useResetPlanChat, useSendPlanChatMessage } from "@/lib/db/hooks"
import type { PlanWeekMeal } from "@/lib/db/types"

export default function PlansPage() {
  const { user } = useSession()
  const { toast } = useToast()
  const [anchorDate, setAnchorDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState<PlanWeekMeal | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(anchorDate, { weekStartsOn: 1 })
  const weekStartKey = format(weekStart, "yyyy-MM-dd")
  const weekEndKey = format(weekEnd, "yyyy-MM-dd")
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`

  const weekMealsQuery = usePlanWeek(user?.id, weekStartKey, weekEndKey)
  const chatQuery = usePlanChat(user?.id, weekStartKey)
  const sendChatMutation = useSendPlanChatMessage(user?.id, weekStartKey)
  const resetChatMutation = useResetPlanChat(user?.id, weekStartKey)

  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])

  const mealsByDate = useMemo(() => {
    const map = new Map<string, PlanWeekMeal[]>()
    ;(weekMealsQuery.data ?? []).forEach((meal) => {
      if (!map.has(meal.date)) {
        map.set(meal.date, [])
      }
      map.get(meal.date)?.push(meal)
    })
    map.forEach((items) => items.sort((a, b) => a.slot - b.slot))
    return map
  }, [weekMealsQuery.data])

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

  const openMealDetails = (meal: PlanWeekMeal) => {
    setSelectedMeal(meal)
    setSelectedDay(null)
    setDetailsOpen(true)
  }

  const openDayDetails = (date: Date) => {
    setSelectedDay(date)
    setSelectedMeal(null)
    setDetailsOpen(true)
  }

  if (weekMealsQuery.isError || chatQuery.isError) {
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
        />

        {weekMealsQuery.isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            {days.map((day) => (
              <Skeleton key={day.toISOString()} className="h-72 w-full" />
            ))}
          </div>
        ) : (weekMealsQuery.data ?? []).length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No meals planned for this week yet.</p>
            <Button variant="outline" className="rounded-full text-xs">Generate plan</Button>
          </div>
        ) : (
          <div className="bg-card border border-border/60 rounded-3xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
              {days.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd")
                const meals = mealsByDate.get(dateKey) ?? []
                return (
                  <DayPlanCard
                    key={dateKey}
                    date={day}
                    meals={meals}
                    maxMeals={3}
                    onSelectMeal={openMealDetails}
                    onSelectDay={openDayDetails}
                  />
                )
              })}
            </div>
          </div>
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

      <PlanDetailsDrawer
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        selectedMeal={selectedMeal}
        selectedDay={selectedDay}
        dayMeals={selectedDay ? mealsByDate.get(format(selectedDay, "yyyy-MM-dd")) ?? [] : []}
      />

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

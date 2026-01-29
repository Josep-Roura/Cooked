"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { addDays, format, parseISO } from "date-fns"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { DateRangeSelector } from "@/components/dashboard/widgets/date-range-selector"
import { TodaysMacrosCard } from "@/components/dashboard/widgets/todays-macros-card"
import { TodaysTrainingCard } from "@/components/dashboard/widgets/todays-training-card"
import { UpcomingEventCard } from "@/components/dashboard/widgets/upcoming-event-card"
import { EventManagementSheet } from "@/components/dashboard/widgets/event-management-sheet"
import { PlanCard } from "@/components/dashboard/widgets/plan-card"
import {
  useDashboardOverview,
  useMacrosDay,
  useMealPlanDay,
  useTrainingSessions,
  useUpdateMealIngredient,
  useUpdateMealPlanItem,
  useUserEvents,
  useProfile,
} from "@/lib/db/hooks"
import type { DateRangeOption, TrainingSessionSummary } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"
import { useEnsureNutritionPlan } from "@/lib/nutrition/ensure"

export function OverviewPage() {
  const shouldReduceMotion = useReducedMotion()
  const { toast } = useToast()
  const { user } = useSession()
  const profileQuery = useProfile(user?.id)
  const [now] = useState(() => new Date())
  const [range, setRange] = useState<DateRangeOption>("today")
  const [selectedDate, setSelectedDate] = useState(() => format(now, "yyyy-MM-dd"))
  const [eventsOpen, setEventsOpen] = useState(false)
  const [highlightMeals, setHighlightMeals] = useState(false)
  const overviewQuery = useDashboardOverview(user?.id, profileQuery.data, range)
  useEnsureNutritionPlan({ userId: user?.id, range, enabled: Boolean(user?.id) })
  const todayKey = format(now, "yyyy-MM-dd")
  const eventsQuery = useUserEvents(
    user?.id,
    format(now, "yyyy-MM-dd"),
    format(addDays(now, 365), "yyyy-MM-dd"),
  )
  const mealPlanQuery = useMealPlanDay(user?.id, selectedDate)
  const macrosQuery = useMacrosDay(user?.id, selectedDate)
  const selectedTrainingQuery = useTrainingSessions(user?.id, selectedDate, selectedDate)
  const updateMealItemMutation = useUpdateMealPlanItem()
  const updateMealIngredientMutation = useUpdateMealIngredient()
  const planRef = useRef<HTMLDivElement | null>(null)

  const animationProps = useMemo(
    () =>
      shouldReduceMotion
        ? {}
        : {
            initial: { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.3 },
          },
    [shouldReduceMotion],
  )

  const hoverProps = shouldReduceMotion
    ? {}
    : {
        whileHover: { y: -2 },
        transition: { duration: 0.2 },
      }

  const handleRefresh = async () => {
    await Promise.all([
      overviewQuery.refetch(),
      eventsQuery.refetch(),
      mealPlanQuery.refetch(),
      macrosQuery.refetch(),
    ])
    toast({ title: "Dashboard refreshed", description: "Latest data has been loaded." })
  }

  const handleSelectSession = (session: TrainingSessionSummary) => {
    toast({ title: "Session selected", description: `${session.title} details opened.` })
  }

  useEffect(() => {
    if (eventsQuery.isError) {
      toast({ title: "Unable to load events", description: "Please try again later.", variant: "destructive" })
    }
  }, [eventsQuery.isError, toast])

  useEffect(() => {
    if (mealPlanQuery.isError) {
      toast({ title: "Unable to load meal plan", description: "Please try again later.", variant: "destructive" })
    }
  }, [mealPlanQuery.isError, toast])


  if (overviewQuery.isError) {
    return <ErrorState onRetry={() => overviewQuery.refetch()} />
  }

  const events = eventsQuery.data ?? []
  const mealPlanDay = mealPlanQuery.data ?? { plan: null, items: [] }
  const consumedMacros = macrosQuery.data?.consumed ?? null
  const targetMacros = macrosQuery.data?.target ?? null
  const selectedConsumedMacros = macrosQuery.data?.consumed ?? { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, intra_cho_g_per_h: 0 }
  const selectedTargetMacros = macrosQuery.data?.target ?? null
  const selectedPercent = macrosQuery.data?.percent ?? 0

  const totalMeals = mealPlanDay.items.length
  const completedMeals = mealPlanDay.items.filter((meal) => meal.eaten).length
  const mealsRemaining = totalMeals > 0 && completedMeals < totalMeals
  const mealsProgressLabel = `${completedMeals}/${totalMeals}`

  const trainingSessionsSelected = selectedTrainingQuery.data ?? []
  const trainingSummary = trainingSessionsSelected.reduce(
    (acc, session) => {
      acc.sessions += 1
      acc.durationMinutes += session.durationMinutes
      return acc
    },
    { sessions: 0, durationMinutes: 0 },
  )

  const isAfterCutoff = selectedDate === todayKey && now.getHours() >= 18
  const completionPercent = totalMeals > 0 ? (completedMeals / totalMeals) * 100 : 0

  const status = (() => {
    if (selectedTargetMacros?.kcal && selectedPercent > 125) return "Behind"
    if (selectedTargetMacros?.kcal && selectedPercent < 60) return "Behind"
    if (isAfterCutoff && totalMeals > 0 && completedMeals === 0) return "Behind"
    if (selectedTargetMacros?.kcal && selectedPercent >= 60 && selectedPercent <= 79) return "Slightly off"
    if (selectedTargetMacros?.kcal && selectedPercent >= 111 && selectedPercent <= 125) return "Slightly off"
    if (!isAfterCutoff || completionPercent >= 50) return "On track"
    return "Behind"
  })()

  const statusTone = status === "On track" ? "bg-emerald-100 text-emerald-700" : status === "Slightly off" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"

  const handleFinishMeals = () => {
    setSelectedDate(todayKey)
    setHighlightMeals(true)
    planRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    window.setTimeout(() => setHighlightMeals(false), 2500)
  }

  const upcomingEvents = events
    .filter((event: any) => {
      const timeValue = event.time ?? "23:59"
      const dateValue = new Date(`${event.date}T${timeValue}:00`)
      return dateValue.getTime() >= now.getTime()
    })
    .sort((a: any, b: any) => {
      const aTime = new Date(`${a.date}T${a.time ?? "23:59"}:00`).getTime()
      const bTime = new Date(`${b.date}T${b.time ?? "23:59"}:00`).getTime()
      return aTime - bTime
    })
    .slice(0, 3)

  return (
    <main className="flex-1 p-8 bg-background overflow-auto">
      <motion.div className="mb-6" {...animationProps}>
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected day</p>
            <h2 className="text-2xl font-bold text-foreground">
              {format(parseISO(selectedDate), "EEEE, MMMM d")}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{mealsProgressLabel} meals logged</span>
              <span>
                {selectedConsumedMacros.kcal}/{selectedTargetMacros?.kcal ?? 0} kcal · {selectedPercent}% of target
              </span>
              <span>
                {trainingSummary.sessions} sessions · {Math.round(trainingSummary.durationMinutes)} min
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className={`rounded-full px-3 py-1 text-xs ${statusTone}`}>{status}</Badge>
            {mealsRemaining && selectedDate === todayKey ? (
              <Button onClick={handleFinishMeals} className="rounded-full text-xs px-4" type="button">
                Finish today&apos;s meals
              </Button>
            ) : (
              <Button asChild className="rounded-full text-xs px-4">
                <Link href={`/dashboard/nutrition?date=${selectedDate}`}>View nutrition details</Link>
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Overview</h2>
        <div className="flex items-center gap-3">
          <DateRangeSelector value={range} onChange={setRange} />
          <Button variant="outline" className="rounded-full px-4 text-xs" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

        <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" {...animationProps}>
          <motion.div {...hoverProps}>
            <TodaysMacrosCard
              consumed={consumedMacros}
              target={targetMacros}
              isLoading={macrosQuery.isLoading}
              label={`Macros for ${format(parseISO(selectedDate), "MMM d")}`}
            />
          </motion.div>
        <motion.div {...hoverProps}>
          <UpcomingEventCard
            isLoading={eventsQuery.isLoading}
            events={upcomingEvents}
            onEdit={() => setEventsOpen(true)}
          />
        </motion.div>
      </motion.div>

      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" {...animationProps}>
        <motion.div {...hoverProps}>
            <TodaysTrainingCard
              isLoading={selectedTrainingQuery.isLoading}
              sessions={trainingSessionsSelected}
              onSelect={handleSelectSession}
              title={format(parseISO(selectedDate), "EEEE, MMM d")}
            />
        </motion.div>
        <motion.div {...hoverProps} ref={planRef}>
          <PlanCard
            date={selectedDate}
            onPreviousDay={() =>
              setSelectedDate(format(addDays(parseISO(selectedDate), -1), "yyyy-MM-dd"))
            }
            onNextDay={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            onToday={() => setSelectedDate(todayKey)}
            plan={mealPlanDay}
            isLoading={mealPlanQuery.isLoading}
            isUpdating={updateMealItemMutation.isPending || updateMealIngredientMutation.isPending}
            highlightUnchecked={highlightMeals && selectedDate === todayKey}
            onToggleMeal={(itemId, eaten) => updateMealItemMutation.mutate({ id: itemId, payload: { eaten } })}
            onToggleIngredient={(ingredientId, checked) =>
              updateMealIngredientMutation.mutate({ id: ingredientId, checked })
            }
          />
        </motion.div>
      </motion.div>

      <EventManagementSheet
        open={eventsOpen}
        onOpenChange={setEventsOpen}
        events={events}
        onRefresh={eventsQuery.refetch}
      />
    </main>
  )
}

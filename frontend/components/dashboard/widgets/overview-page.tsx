"use client"

import { useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { addDays, format, parseISO } from "date-fns"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/use-toast"
import { DateRangeSelector } from "@/components/dashboard/widgets/date-range-selector"
import { TodaysMacrosCard } from "@/components/dashboard/widgets/todays-macros-card"
import { TodaysTrainingCard } from "@/components/dashboard/widgets/todays-training-card"
import { UpcomingEventCard } from "@/components/dashboard/widgets/upcoming-event-card"
import { EventManagementSheet } from "@/components/dashboard/widgets/event-management-sheet"
import { PlanCard } from "@/components/dashboard/widgets/plan-card"
import {
  updateMealCompletion,
  useDashboardOverview,
  useEvents,
  useMealLog,
  useMealSchedule,
  useNutritionDay,
  useProfile,
} from "@/lib/db/hooks"
import type { DateRangeOption, Meal, NutritionMacros, TrainingSessionSummary } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"
import { useEnsureNutritionPlan } from "@/lib/nutrition/ensure"

export function OverviewPage() {
  const shouldReduceMotion = useReducedMotion()
  const { toast } = useToast()
  const { user } = useSession()
  const queryClient = useQueryClient()
  const profileQuery = useProfile(user?.id)
  const [range, setRange] = useState<DateRangeOption>("today")
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [eventsOpen, setEventsOpen] = useState(false)
  const overviewQuery = useDashboardOverview(user?.id, profileQuery.data, range)
  const eventsQuery = useEvents(user?.id)
  const nutritionDayQuery = useNutritionDay(user?.id, selectedDate)
  const mealScheduleQuery = useMealSchedule(user?.id, selectedDate, selectedDate)
  const mealLogQuery = useMealLog(user?.id, selectedDate)

  useEnsureNutritionPlan({ userId: user?.id, range })

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
    await overviewQuery.refetch()
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
    if (nutritionDayQuery.isError) {
      toast({ title: "Unable to load meal plan", description: "Please try again later.", variant: "destructive" })
    }
  }, [nutritionDayQuery.isError, toast])

  if (overviewQuery.isError) {
    return <ErrorState onRetry={() => overviewQuery.refetch()} />
  }

  const events = eventsQuery.data ?? []
  const dayPlan = nutritionDayQuery.data?.plan ?? null

  const consumedMacros = useMemo<NutritionMacros | null>(() => {
    const scheduleItems = mealScheduleQuery.data ?? []
    const logEntries = mealLogQuery.data ?? []

    if (scheduleItems.length > 0 || logEntries.length > 0) {
      const eatenSlots = new Set(logEntries.filter((entry) => entry.is_eaten).map((entry) => entry.slot))
      return scheduleItems.reduce(
        (acc, meal) => {
          if (!eatenSlots.has(meal.slot)) return acc
          acc.kcal += meal.kcal
          acc.protein_g += meal.protein_g
          acc.carbs_g += meal.carbs_g
          acc.fat_g += meal.fat_g
          return acc
        },
        { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, intra_cho_g_per_h: 0 },
      )
    }

    if (!dayPlan?.meals) return null
    return dayPlan.meals.reduce(
      (acc, meal) => {
        if (!meal.completed) return acc
        acc.kcal += meal.kcal
        acc.protein_g += meal.protein_g
        acc.carbs_g += meal.carbs_g
        acc.fat_g += meal.fat_g
        return acc
      },
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, intra_cho_g_per_h: 0 },
    )
  }, [dayPlan?.meals, mealLogQuery.data, mealScheduleQuery.data])

  const targetMacros = dayPlan?.macros ?? null

  const toggleMealMutation = useMutation({
    mutationFn: async ({ slot, completed }: { slot: number; completed: boolean }) =>
      updateMealCompletion({ date: selectedDate, slot, completed }),
    onMutate: async ({ slot, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["db", "nutrition-day", user?.id, selectedDate] })
      const previous = queryClient.getQueryData<{ exists: boolean; plan: { meals: Meal[] } | null }>([
        "db",
        "nutrition-day",
        user?.id,
        selectedDate,
      ])

      if (previous?.plan?.meals) {
        const updatedMeals = previous.plan.meals.map((meal) =>
          meal.slot === slot ? { ...meal, completed } : meal,
        )
        queryClient.setQueryData(
          ["db", "nutrition-day", user?.id, selectedDate],
          { ...previous, plan: { ...previous.plan, meals: updatedMeals } },
        )
      }

      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["db", "nutrition-day", user?.id, selectedDate], context.previous)
      }
      toast({
        title: "Unable to update meal",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    },
    onSuccess: (meals) => {
      queryClient.setQueryData(
        ["db", "nutrition-day", user?.id, selectedDate],
        (current: { exists: boolean; plan: { meals: Meal[] } | null } | undefined) =>
          current?.plan ? { ...current, plan: { ...current.plan, meals } } : current,
      )
    },
  })

  const now = new Date()

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
            isLoading={nutritionDayQuery.isLoading}
            label={selectedDate === format(new Date(), "yyyy-MM-dd") ? "Today's macros" : "Consumed macros"}
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
            isLoading={overviewQuery.isLoading}
            sessions={overviewQuery.data?.trainingSessions ?? []}
            onSelect={handleSelectSession}
          />
        </motion.div>
        <motion.div {...hoverProps}>
          <PlanCard
            date={selectedDate}
            onPreviousDay={() =>
              setSelectedDate(format(addDays(parseISO(selectedDate), -1), "yyyy-MM-dd"))
            }
            onNextDay={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            plan={dayPlan}
            isLoading={nutritionDayQuery.isLoading}
            isUpdating={toggleMealMutation.isPending}
            onToggleMeal={(slot, completed) => toggleMealMutation.mutate({ slot, completed })}
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

"use client"

import { useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { addDays, format, parseISO } from "date-fns"
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
  useDashboardOverview,
  useEnsureMealPlans,
  useMacrosDay,
  useMealPlanDay,
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
  const [range, setRange] = useState<DateRangeOption>("today")
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [eventsOpen, setEventsOpen] = useState(false)
  const overviewQuery = useDashboardOverview(user?.id, profileQuery.data, range)
  const eventsQuery = useUserEvents(
    user?.id,
    format(new Date(), "yyyy-MM-dd"),
    format(addDays(new Date(), 365), "yyyy-MM-dd"),
  )
  const mealPlanQuery = useMealPlanDay(user?.id, selectedDate)
  const macrosQuery = useMacrosDay(user?.id, selectedDate)
  const ensureMealsMutation = useEnsureMealPlans()
  const updateMealItemMutation = useUpdateMealPlanItem()
  const updateMealIngredientMutation = useUpdateMealIngredient()

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

  useEffect(() => {
    if (!user?.id) return
    ensureMealsMutation.mutate({ start: selectedDate, end: selectedDate })
  }, [ensureMealsMutation, selectedDate, user?.id])

  if (overviewQuery.isError) {
    return <ErrorState onRetry={() => overviewQuery.refetch()} />
  }

  const events = eventsQuery.data ?? []
  const mealPlanDay = mealPlanQuery.data ?? { plan: null, items: [] }
  const consumedMacros = macrosQuery.data?.consumed ?? null
  const targetMacros = macrosQuery.data?.target ?? null

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
              isLoading={macrosQuery.isLoading}
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
            plan={mealPlanDay}
            isLoading={mealPlanQuery.isLoading}
            isUpdating={updateMealItemMutation.isPending || updateMealIngredientMutation.isPending}
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

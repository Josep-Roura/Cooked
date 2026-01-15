"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/use-toast"
import { DateRangeSelector } from "@/components/dashboard/widgets/date-range-selector"
import { TodaysMacrosCard } from "@/components/dashboard/widgets/todays-macros-card"
import { TodaysTrainingCard } from "@/components/dashboard/widgets/todays-training-card"
import { UpcomingEventCard } from "@/components/dashboard/widgets/upcoming-event-card"
import { PlanCard } from "@/components/dashboard/widgets/plan-card"
import { useDashboardOverview, useProfile } from "@/lib/db/hooks"
import type { DateRangeOption, TrainingSessionSummary } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"

export function OverviewPage() {
  const shouldReduceMotion = useReducedMotion()
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useSession()
  const profileQuery = useProfile(user?.id)
  const [range, setRange] = useState<DateRangeOption>("today")
  const overviewQuery = useDashboardOverview(user?.id, profileQuery.data, range)

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

  if (overviewQuery.isError) {
    return <ErrorState onRetry={() => overviewQuery.refetch()} />
  }

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
          <TodaysMacrosCard data={overviewQuery.data?.macros} isLoading={overviewQuery.isLoading} />
        </motion.div>
        <motion.div {...hoverProps}>
          <UpcomingEventCard
            isLoading={overviewQuery.isLoading}
            event={overviewQuery.data?.upcomingEvent ?? null}
            onEdit={() => router.push("/onboarding")}
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
            plan={overviewQuery.data?.planPreview ?? null}
            isLoading={overviewQuery.isLoading}
            onOpenDetails={() => router.push("/dashboard/plans")}
          />
        </motion.div>
      </motion.div>
    </main>
  )
}

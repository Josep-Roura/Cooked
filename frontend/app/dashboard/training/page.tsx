"use client"

import { useMemo } from "react"
import { ChevronLeft, ChevronRight, Activity, Clock } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { WeeklyHistory } from "@/components/dashboard/training/weekly-history"
import { useTrainingSessions } from "@/lib/db/hooks"
import type { TrainingSessionSummary, TrainingType } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"
import { useDashboardDate } from "@/components/dashboard/dashboard-date-context"

const typeIcons: Record<TrainingType, string> = {
  swim: "🏊",
  bike: "🚴",
  run: "🏃",
  strength: "💪",
  rest: "🧘",
  other: "🏋️",
}

function getFuelingHints(session: TrainingSessionSummary) {
  if (session.type === "rest") {
    return { before: undefined, during: undefined, after: "Rest day: keep hydration steady." }
  }
  const hints: { before?: string; during?: string; after?: string } = {}
  if (session.durationMinutes >= 60) {
    hints.before = "Have carbs before this session."
  }
  if (session.durationMinutes >= 75 && ["run", "bike", "swim"].includes(session.type)) {
    hints.during = "Plan carbs + fluids during the session."
  }
  if (session.durationMinutes >= 90) {
    hints.during = "Carbs, fluids, and sodium during this session."
  }
  if (session.intensity === "high") {
    hints.after = "Recovery meal with carbs + protein."
  }
  if (session.type === "strength" && session.durationMinutes >= 45) {
    hints.after = "Protein-focused recovery meal."
  }
  return hints
}

export default function TrainingPage() {
  const { user } = useSession()
  const { selectedDate, nextDay, prevDay, setFromWeekDayClick } = useDashboardDate()

  const weekStart = new Date(selectedDate)
  weekStart.setDate(selectedDate.getDate() - ((selectedDate.getDay() + 6) % 7))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const weekStartKey = format(weekStart, "yyyy-MM-dd")
  const weekEndKey = format(weekEnd, "yyyy-MM-dd")
  const selectedDateKey = format(selectedDate, "yyyy-MM-dd")

  const trainingQuery = useTrainingSessions(user?.id, weekStartKey, weekEndKey)

  const weeklyTotals = useMemo(() => {
    const sessions = trainingQuery.data ?? []
    const days = Array.from({ length: 7 }, (_value, index) => {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + index)
      const dateKey = format(date, "yyyy-MM-dd")
      const daySessions = sessions.filter((session) => session.date === dateKey)

      const totalsByType: Record<TrainingType, number> = {
        swim: 0,
        bike: 0,
        run: 0,
        strength: 0,
        rest: 0,
        other: 0,
      }

      daySessions.forEach((session) => {
        totalsByType[session.type] = (totalsByType[session.type] ?? 0) + session.durationMinutes
      })

      const totalMinutes = Object.values(totalsByType).reduce((sum, value) => sum + value, 0)

      return {
        date: dateKey,
        label: format(date, "EEE"),
        displayLabel: format(date, "EEE dd MMM"),
        totalsByType,
        totalMinutes,
        isSelected: dateKey === selectedDateKey,
      }
    })

    const totalDurationMinutes = days.reduce((sum, day) => sum + day.totalMinutes, 0)

    return { totalDurationMinutes, days }
  }, [selectedDateKey, trainingQuery.data, weekStart])

  const daySessions = useMemo(() => {
    return (trainingQuery.data ?? [])
      .filter((session) => session.date === selectedDateKey)
      .sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time)
        if (a.time) return -1
        if (b.time) return 1
        return a.title.localeCompare(b.title)
      })
  }, [selectedDateKey, trainingQuery.data])

  if (trainingQuery.isError) {
    return <ErrorState onRetry={() => trainingQuery.refetch()} />
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-foreground">Training</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-foreground">
              {format(selectedDate, "EEE, MMM d")}
            </span>
            <Button variant="outline" size="icon" onClick={nextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Sessions</h2>
              <span className="text-xs text-muted-foreground">{daySessions.length} sessions</span>
            </div>

            {trainingQuery.isLoading ? (
              <div className="space-y-3">
                <div className="h-16 rounded-xl bg-muted" />
                <div className="h-16 rounded-xl bg-muted" />
              </div>
            ) : daySessions.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No training planned for this day."
                description="Check another day to see your sessions."
              />
            ) : (
              <div className="space-y-3">
                {daySessions.map((session) => {
                  const hints = getFuelingHints(session)
                  return (
                    <div key={session.id} className="rounded-xl border border-border p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
                          {typeIcons[session.type]}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-foreground">{session.title}</h3>
                          <p className="text-xs text-muted-foreground capitalize">
                            {session.type} · {session.durationMinutes}m · {session.intensity}
                          </p>
                          {session.time ? (
                            <p className="text-xs text-muted-foreground mt-1">Start: {session.time}</p>
                          ) : null}
                        </div>
                        {session.calories ? (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {session.calories} kcal
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {hints.before && <span className="rounded-full bg-muted px-3 py-1">Before: {hints.before}</span>}
                        {hints.during && <span className="rounded-full bg-muted px-3 py-1">During: {hints.during}</span>}
                        {hints.after && <span className="rounded-full bg-muted px-3 py-1">After: {hints.after}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <WeeklyHistory
              weeklyData={weeklyTotals}
              onSelectDay={(date) => setFromWeekDayClick(new Date(`${date}T00:00:00`))}
            />
          </div>
        </div>
      </div>
    </main>
  )
}

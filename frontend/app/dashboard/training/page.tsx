"use client"

import { useMemo } from "react"
import { endOfWeek, format, startOfWeek } from "date-fns"
import { ChevronLeft, ChevronRight, Clock } from "lucide-react"
import { WeeklyHistory } from "@/components/dashboard/training/weekly-history"
import { ErrorState } from "@/components/ui/error-state"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTrainingSessions } from "@/lib/db/hooks"
import type { TrainingIntensity, TrainingSessionSummary, TrainingType } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"
import { useDashboardDate } from "@/components/dashboard/dashboard-date-provider"

export default function TrainingPage() {
  const { user } = useSession()
  const { selectedDate, selectedDateKey, nextDay, prevDay, setFromWeekDayClick } = useDashboardDate()
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekStartKey = format(weekStart, "yyyy-MM-dd")
  const weekEndKey = format(weekEnd, "yyyy-MM-dd")

  const trainingQuery = useTrainingSessions(user?.id, weekStartKey, weekEndKey)

  const sessionsForDay = useMemo(() => {
    const sessions = trainingQuery.data ?? []
    return sessions
      .filter((session) => session.date === selectedDateKey)
      .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title))
  }, [selectedDateKey, trainingQuery.data])

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
      }
    })

    const totalDurationMinutes = days.reduce((sum, day) => sum + day.totalMinutes, 0)
    const totalSessions = sessions.length

    return { totalDurationMinutes, totalSessions, days }
  }, [trainingQuery.data, weekStart])

  if (trainingQuery.isError) {
    return <ErrorState onRetry={() => trainingQuery.refetch()} />
  }

  const typeIcons: Record<TrainingType, string> = {
    swim: "🏊",
    bike: "🚴",
    run: "🏃",
    strength: "💪",
    rest: "🧘",
    other: "🏋️",
  }

  const formatIntensity = (intensity: TrainingIntensity) =>
    intensity ? intensity.charAt(0).toUpperCase() + intensity.slice(1) : null

  const getFuelingHints = (session: TrainingSessionSummary) => {
    if (session.type === "rest") {
      return { before: null, during: null, after: null }
    }

    const before =
      session.durationMinutes >= 60 ? "Carbs 30–60 min before" : null

    let during: string | null = null
    if (session.durationMinutes >= 90) {
      during = "Carbs + fluids + sodium during"
    } else if (session.durationMinutes >= 75 && ["run", "bike", "swim"].includes(session.type)) {
      during = "Fuel during with carbs + fluids"
    }

    let after: string | null = null
    if (session.intensity === "high") {
      after = "Recovery meal with carbs + protein"
    } else if (session.type === "strength" && session.durationMinutes >= 45) {
      after = "Protein-focused recovery"
    }

    return { before, during, after }
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Training</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevDay} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground min-w-[120px] text-center">
              {format(selectedDate, "EEE, MMM d")}
            </span>
            <Button variant="outline" size="icon" onClick={nextDay} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Sessions</h2>
            {trainingQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading sessions...</div>
            ) : sessionsForDay.length === 0 ? (
              <div className="text-sm text-muted-foreground">No training planned for this day.</div>
            ) : (
              <div className="space-y-3">
                {sessionsForDay.map((session) => {
                  const hints = getFuelingHints(session)
                  return (
                    <div key={session.id} className="bg-muted rounded-xl p-4 flex gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
                        {typeIcons[session.type]}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">{session.title}</h3>
                          <span className="text-xs text-muted-foreground capitalize">
                            {session.type}
                            {formatIntensity(session.intensity) ? ` • ${formatIntensity(session.intensity)}` : ""}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{session.durationMinutes} min</span>
                          {session.time ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {session.time}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                          {hints.before ? <Badge variant="secondary">Before: {hints.before}</Badge> : null}
                          {hints.during ? <Badge variant="secondary">During: {hints.during}</Badge> : null}
                          {hints.after ? <Badge variant="secondary">After: {hints.after}</Badge> : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div className="max-w-xl">
            <WeeklyHistory
              weeklyData={weeklyTotals}
              selectedDateKey={selectedDateKey}
              onSelectDate={setFromWeekDayClick}
            />
          </div>
        </div>

      </div>
    </main>
  )
}

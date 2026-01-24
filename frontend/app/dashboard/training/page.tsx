"use client"

import { useEffect, useMemo, useState } from "react"
import { addWeeks, endOfWeek, format, isAfter, isWithinInterval, startOfWeek } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { DateRangeSelector } from "@/components/dashboard/widgets/date-range-selector"
import { TrainingList } from "@/components/dashboard/widgets/training-list"
import { WeeklyHistory } from "@/components/dashboard/training/weekly-history"
import { ErrorState } from "@/components/ui/error-state"
import { Button } from "@/components/ui/button"
import { useTrainingSessions } from "@/lib/db/hooks"
import type { DateRangeOption, TrainingType } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"

const PAGE_SIZE = 3

export default function TrainingPage() {
  const { toast } = useToast()
  const { user } = useSession()
  const [range, setRange] = useState<DateRangeOption>("week")
  const [filter, setFilter] = useState<TrainingType | "all">("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  useEffect(() => {
    setPage(0)
  }, [range, filter, search])

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const weekStartKey = format(weekStart, "yyyy-MM-dd")
  const weekEndKey = format(weekEnd, "yyyy-MM-dd")
  const todayKey = format(new Date(), "yyyy-MM-dd")

  useEffect(() => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }, [range])

  const trainingQuery = useTrainingSessions(user?.id, weekStartKey, weekEndKey)

  const filteredSessions = useMemo(() => {
    const sessions = trainingQuery.data ?? []
    const isCurrentWeek = isWithinInterval(new Date(), { start: weekStart, end: weekEnd })
    const isFutureWeek = isAfter(weekStart, new Date())

    const visibleSessions = sessions.filter((session) => {
      if (isCurrentWeek && session.date < todayKey) {
        return false
      }
      if (isFutureWeek && (session.date < weekStartKey || session.date > weekEndKey)) {
        return false
      }
      if (!isCurrentWeek && !isFutureWeek) {
        return false
      }
      if (filter !== "all" && session.type !== filter) {
        return false
      }
      if (!search.trim()) {
        return true
      }
      return session.title.toLowerCase().includes(search.trim().toLowerCase())
    })

    return visibleSessions.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date)
      }
      if (!a.time && !b.time) return 0
      if (!a.time) return 1
      if (!b.time) return -1
      return a.time.localeCompare(b.time)
    })
  }, [filter, search, todayKey, trainingQuery.data, weekEnd, weekEndKey, weekStart, weekStartKey])

  const paginatedSessions = filteredSessions.slice(0, PAGE_SIZE * (page + 1))
  const hasMore = paginatedSessions.length < filteredSessions.length

  const handleLoadMore = () => {
    if (hasMore) {
      setPage((prev) => prev + 1)
    }
  }

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
        isToday: dateKey === todayKey,
      }
    })

    const totalDurationMinutes = days.reduce((sum, day) => sum + day.totalMinutes, 0)
    const totalCalories = sessions.reduce((sum, session) => sum + session.calories, 0)

    return { totalDurationMinutes, totalCalories, days }
  }, [todayKey, trainingQuery.data, weekStart])

  if (trainingQuery.isError) {
    return <ErrorState onRetry={() => trainingQuery.refetch()} />
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Training</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="rounded-full px-4 text-xs" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              Today
            </Button>
            <DateRangeSelector value={range} onChange={setRange} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TrainingList
            sessions={paginatedSessions}
            total={filteredSessions.length}
            hasMore={hasMore}
            isLoading={trainingQuery.isLoading}
            onLoadMore={handleLoadMore}
            filter={filter}
            onFilterChange={setFilter}
            search={search}
            onSearchChange={setSearch}
          />
          <WeeklyHistory weeklyData={weeklyTotals} />
        </div>

        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
            <span className="text-2xl">🔥</span>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Training focus</p>
            <p className="font-semibold text-foreground">Build consistency with weekly progression.</p>
          </div>
          <button
            className="ml-auto text-xs text-primary"
            onClick={() => toast({ title: "Plan updated", description: "Training focus saved." })}
          >
            Save focus
          </button>
        </div>
      </div>
    </main>
  )
}

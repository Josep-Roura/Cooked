"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addWeeks, endOfWeek, format, isWithinInterval, startOfWeek } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { DateRangeSelector } from "@/components/dashboard/widgets/date-range-selector"
import { TrainingList } from "@/components/dashboard/widgets/training-list"
import { WeeklyHistory } from "@/components/dashboard/training/weekly-history"
import { ErrorState } from "@/components/ui/error-state"
import { Button } from "@/components/ui/button"
import { useCreateWorkout, useTrainingSessions } from "@/lib/db/hooks"
import type { DateRangeOption, TrainingType } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"

const PAGE_SIZE = 3

export default function TrainingPage() {
  const { toast } = useToast()
  const { user } = useSession()
  const [now] = useState(() => new Date())
  const [range, setRange] = useState<DateRangeOption>("week")
  const [filter, setFilter] = useState<TrainingType | "all">("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const ensuredRangeRef = useRef<string | null>(null)
  const [newWorkout, setNewWorkout] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    workout_type: "Run",
    title: "",
    start_time: "07:00",
    duration_hours: 1,
    tss: 0,
    rpe: 5,
  })
  const createWorkout = useCreateWorkout(user?.id)

  useEffect(() => {
    setPage(0)
  }, [range, filter, search])

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const weekStartKey = format(weekStart, "yyyy-MM-dd")
  const weekEndKey = format(weekEnd, "yyyy-MM-dd")
  const todayKey = format(now, "yyyy-MM-dd")

  useEffect(() => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }, [range])

  const trainingQuery = useTrainingSessions(user?.id, weekStartKey, weekEndKey)
  const listStart = isWithinInterval(now, { start: weekStart, end: weekEnd })
    ? now
    : weekStart
  const listStartKey = format(listStart, "yyyy-MM-dd")
  const listEndKey = format(endOfWeek(addWeeks(weekStart, page), { weekStartsOn: 1 }), "yyyy-MM-dd")
  const listQuery = useTrainingSessions(user?.id, listStartKey, listEndKey)
  useEffect(() => {
    if (!user?.id || trainingQuery.isLoading) return
    const sessions = trainingQuery.data ?? []
    if (sessions.length === 0) return
    const ensureKey = `${user.id}:${weekStartKey}:${weekEndKey}`
    if (ensuredRangeRef.current === ensureKey) return
    ensuredRangeRef.current = ensureKey
  }, [trainingQuery.data, trainingQuery.isLoading, user?.id, weekEndKey, weekStartKey])

  const filteredSessions = useMemo(() => {
    const sessions = listQuery.data ?? []
    const visibleSessions = sessions.filter((session) => {
      if (session.date < listStartKey) {
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
  }, [filter, listQuery.data, listStartKey, search])

  const paginatedSessions = filteredSessions
  const hasMore = (listQuery.data?.length ?? 0) >= PAGE_SIZE * (page + 1)

  const handleLoadMore = () => {
    if (hasMore) {
      setPage((prev) => prev + 1)
    }
  }

  const handleCreateWorkout = async () => {
    if (!user?.id) {
      toast({ title: "Sign in required", description: "Please sign in to add workouts." })
      return
    }
    try {
      await createWorkout.mutateAsync({
        date: newWorkout.date,
        workout_type: newWorkout.workout_type,
        title: newWorkout.title || undefined,
        start_time: newWorkout.start_time || null,
        duration_hours: Number(newWorkout.duration_hours),
        tss: newWorkout.tss ? Number(newWorkout.tss) : undefined,
        rpe: newWorkout.rpe ? Number(newWorkout.rpe) : undefined,
      })
      toast({ title: "Workout added", description: "Your session is now on the calendar." })
    } catch (error) {
      toast({
        title: "Add workout failed",
        description: error instanceof Error ? error.message : "Unable to add workout.",
        variant: "destructive",
      })
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
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Add a workout</h2>
              <p className="text-xs text-muted-foreground">Log a manual session if you don&apos;t have a CSV import.</p>
            </div>
            <Button onClick={handleCreateWorkout} disabled={createWorkout.isPending}>
              Add workout
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="text-xs text-muted-foreground flex flex-col gap-1">
              Date
              <input
                type="date"
                value={newWorkout.date}
                onChange={(event) => setNewWorkout((prev) => ({ ...prev, date: event.target.value }))}
                className="h-9 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground flex flex-col gap-1">
              Type
              <input
                value={newWorkout.workout_type}
                onChange={(event) => setNewWorkout((prev) => ({ ...prev, workout_type: event.target.value }))}
                className="h-9 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground flex flex-col gap-1">
              Title (optional)
              <input
                value={newWorkout.title}
                onChange={(event) => setNewWorkout((prev) => ({ ...prev, title: event.target.value }))}
                className="h-9 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground flex flex-col gap-1">
              Start time
              <input
                value={newWorkout.start_time}
                onChange={(event) => setNewWorkout((prev) => ({ ...prev, start_time: event.target.value }))}
                className="h-9 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground flex flex-col gap-1">
              Duration (hours)
              <input
                type="number"
                step="0.25"
                min="0.25"
                value={newWorkout.duration_hours}
                onChange={(event) => setNewWorkout((prev) => ({ ...prev, duration_hours: Number(event.target.value) }))}
                className="h-9 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground flex flex-col gap-1">
              Intensity (RPE)
              <input
                type="number"
                min="1"
                max="10"
                value={newWorkout.rpe}
                onChange={(event) => setNewWorkout((prev) => ({ ...prev, rpe: Number(event.target.value) }))}
                className="h-9 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground flex flex-col gap-1">
              TSS (optional)
              <input
                type="number"
                value={newWorkout.tss}
                onChange={(event) => setNewWorkout((prev) => ({ ...prev, tss: Number(event.target.value) }))}
                className="h-9 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
              />
            </label>
          </div>
        </div>
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
            isLoading={trainingQuery.isLoading || listQuery.isLoading}
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

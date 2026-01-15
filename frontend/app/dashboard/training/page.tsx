"use client"

import { useEffect, useMemo, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { DateRangeSelector } from "@/components/dashboard/widgets/date-range-selector"
import { TrainingList } from "@/components/dashboard/widgets/training-list"
import { WeeklyHistory } from "@/components/dashboard/training/weekly-history"
import { ErrorState } from "@/components/ui/error-state"
import { useProfile, useTrainingSummary } from "@/lib/db/hooks"
import type { DateRangeOption, TrainingType } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"

const PAGE_SIZE = 3

export default function TrainingPage() {
  const { toast } = useToast()
  const { user } = useSession()
  const profileQuery = useProfile(user?.id)
  const [range, setRange] = useState<DateRangeOption>("week")
  const [filter, setFilter] = useState<TrainingType | "all">("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)

  useEffect(() => {
    setPage(0)
  }, [range, filter, search])

  const trainingQuery = useTrainingSummary(user?.id, profileQuery.data, range)

  const filteredSessions = useMemo(() => {
    const sessions = trainingQuery.data?.sessions ?? []
    return sessions.filter((session) => {
      if (filter !== "all" && session.type !== filter) {
        return false
      }
      if (!search.trim()) {
        return true
      }
      return session.title.toLowerCase().includes(search.trim().toLowerCase())
    })
  }, [filter, search, trainingQuery.data?.sessions])

  const paginatedSessions = filteredSessions.slice(0, PAGE_SIZE * (page + 1))
  const hasMore = paginatedSessions.length < filteredSessions.length

  const handleLoadMore = () => {
    if (hasMore) {
      setPage((prev) => prev + 1)
    }
  }

  if (trainingQuery.isError) {
    return <ErrorState onRetry={() => trainingQuery.refetch()} />
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Training</h1>
          <DateRangeSelector value={range} onChange={setRange} />
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
          {trainingQuery.data && <WeeklyHistory weeklyData={{
            totalDuration: trainingQuery.data.summary.totalDurationMinutes,
            totalCalories: trainingQuery.data.summary.totalCalories,
            sessions: trainingQuery.data.summary.sessions.map((session) => ({
              day: session.day,
              type: session.type,
              duration: session.durationMinutes,
              intensity: session.intensity,
            })),
          }} />}
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

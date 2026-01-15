"use client"

import { useMemo, useState } from "react"
import { Activity, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import type { TrainingSessionSummary, TrainingType } from "@/lib/db/types"

interface TrainingListProps {
  sessions: TrainingSessionSummary[]
  total: number
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  filter: TrainingType | "all"
  onFilterChange: (value: TrainingType | "all") => void
  search: string
  onSearchChange: (value: string) => void
}

const filterOptions: Array<{ label: string; value: TrainingType | "all" }> = [
  { label: "All", value: "all" },
  { label: "Swim", value: "swim" },
  { label: "Bike", value: "bike" },
  { label: "Run", value: "run" },
  { label: "Strength", value: "strength" },
]

export function TrainingList({
  sessions,
  total,
  hasMore,
  isLoading,
  onLoadMore,
  filter,
  onFilterChange,
  search,
  onSearchChange,
}: TrainingListProps) {
  const [open, setOpen] = useState(false)

  const summary = useMemo(() => {
    return `Showing ${sessions.length} of ${total}`
  }, [sessions.length, total])

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Sessions</h3>
          <p className="text-xs text-muted-foreground">{summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button variant="outline" className="rounded-full px-4 text-xs" onClick={() => setOpen((prev) => !prev)}>
              {filterOptions.find((option) => option.value === filter)?.label}
              <ChevronDown className="h-3 w-3 ml-2" />
            </Button>
            {open && (
              <div className="absolute right-0 mt-2 bg-background border border-border rounded-xl p-2 shadow-lg z-10">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    className="block w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      onFilterChange(option.value)
                      setOpen(false)
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search"
            className="h-9 rounded-full border border-border bg-transparent px-4 text-xs text-muted-foreground"
          />
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No training sessions"
          description="Create a session or update filters to see results."
        />
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between bg-muted rounded-xl p-4">
              <div>
                <p className="font-medium text-foreground">{session.title}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {session.type} • {session.durationMinutes} min • {session.intensity}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{session.time}</span>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-4">
          <Button variant="outline" className="w-full rounded-full" onClick={onLoadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}

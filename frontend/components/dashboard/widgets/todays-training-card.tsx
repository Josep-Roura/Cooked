"use client"

import { useMemo, useState } from "react"
import { Activity, Clock, Filter, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import type { TrainingSessionSummary, TrainingType } from "@/lib/db/types"

interface TodaysTrainingCardProps {
  isLoading: boolean
  sessions: TrainingSessionSummary[]
  onSelect: (session: TrainingSessionSummary) => void
  title?: string
}

const typeIcons: Record<TrainingType, string> = {
  swim: "🏊",
  bike: "🚴",
  run: "🏃",
  strength: "💪",
  rest: "🧘",
  other: "🏋️",
}

const filterOptions: Array<{ label: string; value: TrainingType | "all" }> = [
  { label: "All", value: "all" },
  { label: "Swim", value: "swim" },
  { label: "Bike", value: "bike" },
  { label: "Run", value: "run" },
  { label: "Strength", value: "strength" },
]

export function TodaysTrainingCard({ isLoading, sessions, onSelect, title }: TodaysTrainingCardProps) {
  const [selectedSession, setSelectedSession] = useState<TrainingSessionSummary | null>(null)
  const [filter, setFilter] = useState<TrainingType | "all">("all")
  const [search, setSearch] = useState("")

  const filteredSessions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return sessions.filter((session) => {
      if (filter !== "all" && session.type !== filter) {
        return false
      }
      if (!normalizedSearch) {
        return true
      }
      return session.title.toLowerCase().includes(normalizedSearch)
    })
  }, [filter, search, sessions])

  const handleOpen = (session: TrainingSessionSummary) => {
    setSelectedSession(session)
    onSelect(session)
  }

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{title ?? "Today's Training"}</h3>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            className="bg-transparent text-xs text-muted-foreground"
            value={filter}
            onChange={(event) => setFilter(event.target.value as TrainingType | "all")}
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative mb-4">
        <Input
          placeholder="Search sessions"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-4"
        />
      </div>

      {filteredSessions.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No sessions found"
          description="Try another sport filter or clear your search."
        />
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => handleOpen(session)}
              className="w-full text-left bg-muted rounded-xl p-4 flex items-center gap-4 hover:bg-muted/70 transition"
            >
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
                {typeIcons[session.type]}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">{session.title}</h4>
                <p className="text-sm text-muted-foreground capitalize">{session.type} • {session.intensity}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {session.durationMinutes}m
                </div>
                <div className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  {session.calories} kcal
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Drawer open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DrawerContent>
          {selectedSession && (
            <div className="p-6">
              <DrawerHeader className="p-0 mb-4">
                <DrawerTitle className="text-lg font-semibold">{selectedSession.title}</DrawerTitle>
                <p className="text-sm text-muted-foreground capitalize">
                  {selectedSession.type} • {selectedSession.intensity} • {selectedSession.durationMinutes}m
                </p>
              </DrawerHeader>
              <p className="text-sm text-muted-foreground mb-4">{selectedSession.description}</p>
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-6">
                <span>Scheduled: {selectedSession.time}</span>
                <span>{selectedSession.calories} kcal estimated</span>
              </div>
              {!selectedSession.completed && (
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                  <Play className="h-4 w-4" />
                  Start Workout
                </Button>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}

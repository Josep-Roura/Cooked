"use client"

import { Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import type { ProfileEvent } from "@/lib/db/types"

interface UpcomingEventCardProps {
  isLoading: boolean
  events: ProfileEvent[]
  onEdit: () => void
}

function formatEventDate(event: ProfileEvent) {
  return event.time ? `${event.date} · ${event.time}` : event.date
}

export function UpcomingEventCard({ isLoading, events, onEdit }: UpcomingEventCardProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6">
        <EmptyState
          icon={Calendar}
          title="No upcoming event"
          description="Add your next race or milestone to stay on track."
          actionLabel="Edit events"
          onAction={onEdit}
        />
      </div>
    )
  }

  const visibleEvents = events.slice(0, 3)

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Upcoming event</h3>
        <Button variant="outline" className="rounded-full px-4 text-xs" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <div className="space-y-3">
        {visibleEvents.map((event) => (
          <div key={event.id} className="bg-muted rounded-xl p-4">
            <p className="text-sm text-muted-foreground">{formatEventDate(event)}</p>
            <h4 className="text-lg font-semibold text-foreground mt-1">{event.title}</h4>
            {event.goal && <p className="text-sm text-muted-foreground mt-2">{event.goal}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

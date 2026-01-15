"use client"

import { Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import type { UpcomingEvent } from "@/lib/db/types"

interface UpcomingEventCardProps {
  isLoading: boolean
  event: UpcomingEvent | null
  onEdit: () => void
}

export function UpcomingEventCard({ isLoading, event, onEdit }: UpcomingEventCardProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6">
        <EmptyState
          icon={Calendar}
          title="No upcoming event"
          description="Add your next race or milestone in onboarding."
          actionLabel="Update onboarding"
          onAction={onEdit}
        />
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Upcoming event</h3>
        <Button variant="outline" className="rounded-full px-4 text-xs" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <div className="bg-muted rounded-xl p-4">
        <p className="text-sm text-muted-foreground">{event.date}</p>
        <h4 className="text-lg font-semibold text-foreground mt-1">{event.name}</h4>
        {event.description && <p className="text-sm text-muted-foreground mt-2">{event.description}</p>}
      </div>
    </div>
  )
}

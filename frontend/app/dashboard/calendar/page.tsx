"use client"

import { useMemo, useState } from "react"
import { CalendarView } from "@/components/dashboard/calendar/calendar-view"
import { EventDetailModal } from "@/components/dashboard/calendar/event-detail-modal"
import { ErrorState } from "@/components/ui/error-state"
import { useCalendarEvents, useProfile } from "@/lib/db/hooks"
import type { CalendarEvent, DateRangeOption } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"
import { useEnsureNutritionPlan } from "@/lib/nutrition/ensure"

export default function CalendarPage() {
  const { user } = useSession()
  const profileQuery = useProfile(user?.id)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [view, setView] = useState<"day" | "week" | "month">("week")
  const range: DateRangeOption = view === "month" ? "month" : "week"

  const calendarQuery = useCalendarEvents(user?.id, profileQuery.data, range)

  useEnsureNutritionPlan({ userId: user?.id, range })

  const events = useMemo(() => calendarQuery.data?.calendar ?? [], [calendarQuery.data?.calendar])

  if (calendarQuery.isError) {
    return <ErrorState onRetry={() => calendarQuery.refetch()} />
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      <CalendarView events={events} view={view} onViewChange={setView} onEventClick={setSelectedEvent} />
      <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </main>
  )
}

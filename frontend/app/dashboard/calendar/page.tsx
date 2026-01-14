"use client"

import { useState } from "react"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { CalendarView } from "@/components/dashboard/calendar/calendar-view"
import { EventDetailModal } from "@/components/dashboard/calendar/event-detail-modal"
import { mockCalendarEvents, type CalendarEvent } from "@/lib/mock-data"

export default function CalendarPage() {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [view, setView] = useState<"day" | "week" | "month">("week")

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-8 overflow-auto">
        <CalendarView events={mockCalendarEvents} view={view} onViewChange={setView} onEventClick={setSelectedEvent} />
      </main>
      <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  )
}

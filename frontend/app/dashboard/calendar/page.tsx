"use client"

import { MonthWorkoutCalendar } from "@/components/dashboard/calendar/month-workout-calendar"
import { useSession } from "@/hooks/use-session"

export default function CalendarPage() {
  const { user } = useSession()

  return (
    <main className="flex-1 p-8 overflow-auto">
      <MonthWorkoutCalendar userId={user?.id} />
    </main>
  )
}

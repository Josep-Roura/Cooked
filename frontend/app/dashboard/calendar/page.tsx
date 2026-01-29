"use client"

import { useState } from "react"
import { MonthWorkoutCalendar } from "@/components/dashboard/calendar/month-workout-calendar"
import { WeekScheduleView } from "@/components/dashboard/calendar/week-schedule-view"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession } from "@/hooks/use-session"

export default function CalendarPage() {
  const { user } = useSession()
  const [view, setView] = useState("month")
  const [anchorDate, setAnchorDate] = useState(() => new Date())

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {view === "month" ? (
        <MonthWorkoutCalendar userId={user?.id} />
      ) : (
        <WeekScheduleView userId={user?.id} anchorDate={anchorDate} onAnchorChange={setAnchorDate} />
      )}
    </main>
  )
}

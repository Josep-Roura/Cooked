"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CalendarEvent } from "@/lib/db/types"

interface CalendarViewProps {
  events: CalendarEvent[]
  view: "day" | "week" | "month"
  onViewChange: (view: "day" | "week" | "month") => void
  onEventClick: (event: CalendarEvent) => void
}

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const hours = Array.from({ length: 16 }, (_, i) => i + 6) // 6 AM to 9 PM

export function CalendarView({ events, view, onViewChange, onEventClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date())

  const getWeekDates = () => {
    const start = new Date(currentDate)
    start.setDate(start.getDate() - start.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      return date
    })
  }

  const weekDates = getWeekDates()

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0]
    return events.filter((e) => e.date === dateStr)
  }

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + direction * 7)
    setCurrentDate(newDate)
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigateWeek(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium text-foreground min-w-32 text-center">
              {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <Button variant="ghost" size="icon" onClick={() => navigateWeek(1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["day", "week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => onViewChange(v)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
                type="button"
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2" type="button">
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-400" />
          <span className="text-sm text-muted-foreground">Training</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm text-muted-foreground">Nutrition</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-sm text-muted-foreground">High Intensity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400" />
          <span className="text-sm text-muted-foreground">Rest</span>
        </div>
      </div>

      {/* Week View */}
      {view === "week" && (
        <div className="flex-1 border border-border rounded-xl overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b border-border bg-muted/30">
            <div className="p-3 text-sm text-muted-foreground" />
            {weekDates.map((date, i) => (
              <div
                key={i}
                className={`p-3 text-center border-l border-border ${isToday(date) ? "bg-primary/10" : ""}`}
              >
                <div className="text-xs text-muted-foreground">{weekDays[date.getDay()]}</div>
                <div className={`text-lg font-semibold ${isToday(date) ? "text-primary" : "text-foreground"}`}>
                  {date.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Time Grid */}
          <div className="overflow-y-auto max-h-[calc(100vh-320px)]">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-border/50 min-h-16">
                <div className="p-2 text-xs text-muted-foreground text-right pr-3">
                  {hour.toString().padStart(2, "0")}:00
                </div>

                {weekDates.map((date, dayIndex) => {
                  const dayEvents = getEventsForDate(date)
                  const hourEvents = dayEvents.filter((e) => {
                    const eventHour = Number.parseInt(e.startTime.split(":")[0])
                    return eventHour === hour
                  })

                  return (
                    <div
                      key={dayIndex}
                      className={`border-l border-border/50 relative ${isToday(date) ? "bg-primary/5" : ""}`}
                    >
                      {hourEvents.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => onEventClick(event)}
                          className={`absolute inset-x-1 top-1 rounded-lg p-2 text-left ${event.color} text-white text-xs z-10 hover:opacity-90 transition-opacity`}
                          type="button"
                        >
                          <div className="font-medium truncate">{event.title}</div>
                          <div className="opacity-80 truncate">{event.startTime}</div>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month View */}
      {view === "month" && (
        <div className="flex-1 border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-muted/30">
            {weekDays.map((day) => (
              <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 grid-rows-5">
            {Array.from({ length: 35 }, (_, i) => {
              const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i - 3)
              const dayEvents = getEventsForDate(date)
              const isCurrentMonth = date.getMonth() === currentDate.getMonth()

              return (
                <div
                  key={i}
                  className={`min-h-24 p-2 border-b border-r border-border/50 ${!isCurrentMonth ? "bg-muted/20" : ""} ${
                    isToday(date) ? "bg-primary/10" : ""
                  }`}
                >
                  <div
                    className={`text-sm mb-1 ${isCurrentMonth ? "text-foreground" : "text-muted-foreground"} ${
                      isToday(date) ? "font-bold text-primary" : ""
                    }`}
                  >
                    {date.getDate()}
                  </div>

                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className={`w-full text-left text-xs p-1 rounded ${event.color} text-white truncate hover:opacity-90`}
                        type="button"
                      >
                        {event.title}
                      </button>
                    ))}

                    {dayEvents.length > 2 && (
                      <div className="text-xs text-muted-foreground">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Day View */}
      {view === "day" && (
        <div className="flex-1 border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="text-lg font-semibold text-foreground">
              {currentDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>

          <div className="overflow-y-auto max-h-[calc(100vh-380px)]">
            {hours.map((hour) => {
              const dayEvents = getEventsForDate(currentDate)
              const hourEvents = dayEvents.filter((e) => {
                const eventHour = Number.parseInt(e.startTime.split(":")[0])
                return eventHour === hour
              })

              return (
                <div key={hour} className="flex border-b border-border/50 min-h-20">
                  <div className="w-20 p-3 text-sm text-muted-foreground text-right">
                    {hour.toString().padStart(2, "0")}:00
                  </div>

                  <div className="flex-1 relative border-l border-border/50 p-1">
                    {hourEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className={`w-full rounded-lg p-3 text-left ${event.color} text-white mb-1 hover:opacity-90 transition-opacity`}
                        type="button"
                      >
                        <div className="font-medium">{event.title}</div>
                        <div className="text-sm opacity-80">
                          {event.startTime} - {event.endTime}
                        </div>
                        {event.description && <div className="text-sm opacity-70 mt-1">{event.description}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

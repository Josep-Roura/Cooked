"use client"

import { format } from "date-fns"
import type { ScheduleItem } from "@/components/dashboard/schedule/types"
import { ScheduleBlock } from "@/components/dashboard/schedule/schedule-block"
import { DEFAULT_END_HOUR, DEFAULT_START_HOUR, HOUR_HEIGHT, timeToMinutes } from "@/components/dashboard/schedule/utils"

interface WeeklyTimeGridProps {
  days: Date[]
  items: ScheduleItem[]
  startHour?: number
  endHour?: number
  onSelectItem?: (item: ScheduleItem) => void
}

export function WeeklyTimeGrid({
  days,
  items,
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
  onSelectItem,
}: WeeklyTimeGridProps) {
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index)
  const gridHeight = (endHour - startHour) * HOUR_HEIGHT

  return (
    <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
      <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border/60 bg-muted/30">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="px-3 py-2 text-center">
            <div className="text-xs font-semibold text-foreground">{format(day, "EEE")}</div>
            <div className="text-[11px] text-muted-foreground">{format(day, "MMM d")}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[80px_repeat(7,1fr)]">
        <div className="border-r border-border/50 relative">
          {hours.map((hour) => (
            <div
              key={hour}
              className="h-[60px] px-2 text-[11px] text-muted-foreground flex items-start justify-end"
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd")
          const dayItems = items.filter((item) => item.date === dateKey)
          return (
            <div key={dateKey} className="relative border-r border-border/50" style={{ height: gridHeight }}>
              {hours.map((hour) => (
                <div
                  key={`${dateKey}-${hour}`}
                  className="border-t border-border/40 h-[60px]"
                />
              ))}
              {dayItems.map((item) => {
                const startMinutes = timeToMinutes(item.startTime)
                const endMinutes = timeToMinutes(item.endTime)
                const clampedStart = Math.max(startMinutes, startHour * 60)
                const clampedEnd = Math.min(endMinutes, endHour * 60)
                const top = ((clampedStart - startHour * 60) / 60) * HOUR_HEIGHT
                const height = Math.max(((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT, 24)

                return (
                  <ScheduleBlock
                    key={item.id}
                    item={item}
                    onSelect={onSelectItem}
                    style={{ top, height }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

"use client"

import { format } from "date-fns"
import type { ScheduleItem } from "@/components/dashboard/schedule/types"
import { ScheduleBlock } from "@/components/dashboard/schedule/schedule-block"
import { DEFAULT_END_HOUR, DEFAULT_START_HOUR, clampMinutes, timeToMinutes } from "@/components/dashboard/schedule/utils"

interface WeeklyTimeGridProps {
  days: Date[]
  items: ScheduleItem[]
  onSelectItem?: (item: ScheduleItem) => void
  startHour?: number
  endHour?: number
}

const HOUR_HEIGHT = 56

export function WeeklyTimeGrid({
  days,
  items,
  onSelectItem,
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
}: WeeklyTimeGridProps) {
  const startMinutes = startHour * 60
  const endMinutes = endHour * 60
  const totalMinutes = endMinutes - startMinutes
  const totalHeight = (totalMinutes / 60) * HOUR_HEIGHT

  const itemsByDate = items.reduce<Record<string, ScheduleItem[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = []
    acc[item.date].push(item)
    return acc
  }, {})

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-background">
      <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border bg-muted/30">
        <div className="p-3 text-xs text-muted-foreground">Time</div>
        {days.map((day) => (
          <div key={day.toISOString()} className="p-3 text-xs font-semibold text-foreground">
            {format(day, "EEE dd")}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[80px_repeat(7,1fr)]">
        <div className="relative border-r border-border bg-muted/10">
          {hours.map((hour) => (
            <div
              key={hour}
              className="h-[56px] border-b border-border/40 px-3 text-[10px] text-muted-foreground flex items-start pt-1"
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd")
          const dayItems = itemsByDate[dateKey] ?? []

          return (
            <div key={dateKey} className="relative border-r border-border bg-background">
              <div className="relative" style={{ height: totalHeight }}>
                {dayItems.map((item) => {
                  const start = clampMinutes(timeToMinutes(item.startTime), startMinutes, endMinutes)
                  const end = clampMinutes(timeToMinutes(item.endTime), startMinutes, endMinutes)
                  const top = ((start - startMinutes) / totalMinutes) * totalHeight
                  const height = Math.max(((end - start) / totalMinutes) * totalHeight, 22)
                  return (
                    <ScheduleBlock
                      key={item.id}
                      item={item}
                      top={top}
                      height={height}
                      onSelect={onSelectItem}
                    />
                  )
                })}
              </div>
              {hours.map((hour) => (
                <div key={`${dateKey}-${hour}`} className="h-[56px] border-b border-border/30" />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

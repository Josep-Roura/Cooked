"use client"

import { format, isSameDay, isSameMonth } from "date-fns"
import { cn } from "@/lib/utils"

export interface CalendarMonthItem {
  id: string
  date: string
  label: string
  tone: "meal" | "workout" | "event"
}

interface CalendarMonthGridProps {
  days: Date[]
  currentDate: Date
  items: CalendarMonthItem[]
  onSelectItem?: (item: CalendarMonthItem) => void
}

const toneStyles: Record<CalendarMonthItem["tone"], string> = {
  meal: "bg-emerald-50 text-emerald-700",
  workout: "bg-blue-50 text-blue-700",
  event: "bg-amber-50 text-amber-700",
}

export function CalendarMonthGrid({ days, currentDate, items, onSelectItem }: CalendarMonthGridProps) {
  const today = new Date()

  return (
    <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-[minmax(140px,1fr)]">
        {days.map((date, index) => {
          const dateKey = format(date, "yyyy-MM-dd")
          const dayItems = items.filter((item) => item.date === dateKey)
          const visibleItems = dayItems.slice(0, 3)
          const extraCount = dayItems.length - visibleItems.length
          const inMonth = isSameMonth(date, currentDate)
          const isToday = isSameDay(date, today)

          return (
            <div
              key={dateKey}
              className={cn(
                "border-b border-border/50 border-r border-border/50 p-2 flex flex-col gap-2",
                !inMonth && "bg-muted/20 text-muted-foreground",
                isToday && "bg-primary/10",
                index % 7 === 6 && "border-r-0",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-semibold", isToday && "text-primary")}>{format(date, "d")}</span>
                {extraCount > 0 ? (
                  <span className="text-[10px] text-muted-foreground">+{extraCount} more</span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                {visibleItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectItem?.(item)}
                    className={cn(
                      "rounded-md px-2 py-1 text-[10px] font-semibold truncate text-left",
                      toneStyles[item.tone],
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

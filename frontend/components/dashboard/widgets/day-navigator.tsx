"use client"

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface DayNavigatorProps {
  date: Date
  onPreviousDay: () => void
  onNextDay: () => void
  onSelectDate: (date: Date) => void
  onToday?: () => void
}

export function DayNavigator({ date, onPreviousDay, onNextDay, onSelectDate, onToday }: DayNavigatorProps) {
  const formatted = format(date, "MMM d, yyyy")
  const inputValue = format(date, "yyyy-MM-dd")

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onToday ? (
        <Button variant="ghost" className="rounded-full h-8 px-3 text-xs" onClick={onToday}>
          Today
        </Button>
      ) : null}
      <Button variant="outline" className="rounded-full h-9 w-9 p-0" onClick={onPreviousDay}>
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Previous day</span>
      </Button>
      <div className="relative">
        <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="date"
          value={inputValue}
          onChange={(event) => {
            const value = event.target.value
            if (!value) return
            onSelectDate(parseISO(value))
          }}
          className="h-9 w-[150px] rounded-full pl-9 text-xs"
          aria-label={`Selected day ${formatted}`}
        />
      </div>
      <Button variant="outline" className="rounded-full h-9 w-9 p-0" onClick={onNextDay}>
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Next day</span>
      </Button>
    </div>
  )
}

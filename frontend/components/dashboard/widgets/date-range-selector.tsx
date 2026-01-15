"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DateRangeOption } from "@/lib/db/types"

interface DateRangeSelectorProps {
  value: DateRangeOption
  onChange: (value: DateRangeOption) => void
}

const options: Array<{ label: string; value: DateRangeOption }> = [
  { label: "Today", value: "today" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
]

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          variant="outline"
          className={cn(
            "rounded-full px-4 text-xs",
            value === option.value && "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

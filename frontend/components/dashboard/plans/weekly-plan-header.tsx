"use client"

import { Calendar, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface WeeklyPlanHeaderProps {
  weekLabel: string
  onPrevWeek: () => void
  onNextWeek: () => void
  onThisWeek: () => void
  onOpenChat: () => void
  onRegenerateWeek: () => void
  onResetWeek: () => void
  isGenerating: boolean
}

export function WeeklyPlanHeader({
  weekLabel,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  onOpenChat,
  onRegenerateWeek,
  onResetWeek,
  isGenerating,
}: WeeklyPlanHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Plans</h1>
        <p className="text-sm text-muted-foreground">Weekly meal plan</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" className="rounded-full px-4 text-xs" onClick={onThisWeek}>
          This week
        </Button>
        <Button variant="outline" size="icon" onClick={onNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {weekLabel}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="rounded-full text-xs" disabled={isGenerating}>
              Regenerate week
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRegenerateWeek}>Regenerate (respect locks)</DropdownMenuItem>
            <DropdownMenuItem onClick={onResetWeek}>Full reset (clear locks)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button className="rounded-full text-xs" onClick={onOpenChat}>
          <MessageCircle className="h-4 w-4 mr-2" />
          Open plan chat
        </Button>
      </div>
    </div>
  )
}

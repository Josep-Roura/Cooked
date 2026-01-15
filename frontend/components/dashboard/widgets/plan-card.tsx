"use client"

import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { PlanPreview } from "@/lib/db/types"

interface PlanCardProps {
  plan: PlanPreview | null
  isLoading: boolean
  onOpenDetails: () => void
}

export function PlanCard({ plan, isLoading, onOpenDetails }: PlanCardProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Your plan</h3>
        <Button className="rounded-full px-4 text-xs" onClick={onOpenDetails}>
          View plan
        </Button>
      </div>

      {plan ? (
        <div className="bg-muted rounded-xl p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Active plan</p>
          <h4 className="text-lg font-semibold text-foreground">{plan.title}</h4>
          <p className="text-sm text-muted-foreground">Focus: {plan.focus}</p>
          <p className="text-sm text-muted-foreground">{plan.summary}</p>
        </div>
      ) : (
        <div className="bg-muted rounded-xl p-6 text-center">
          <Sparkles className="h-6 w-6 text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No nutrition plan yet.</p>
        </div>
      )}
    </div>
  )
}

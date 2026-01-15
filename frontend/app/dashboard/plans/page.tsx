"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { DateRangeSelector } from "@/components/dashboard/widgets/date-range-selector"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useNutritionPlanRows, useNutritionPlans } from "@/lib/db/hooks"
import type { DateRangeOption } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"

export default function PlansPage() {
  const { user } = useSession()
  const [range, setRange] = useState<DateRangeOption>("month")
  const plansQuery = useNutritionPlans(user?.id)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const planRowsQuery = useNutritionPlanRows(selectedPlanId)

  if (plansQuery.isError) {
    return <ErrorState onRetry={() => plansQuery.refetch()} />
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Plans</h1>
          <DateRangeSelector value={range} onChange={setRange} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Nutrition plans</h3>
            {plansQuery.isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {!plansQuery.isLoading && plansQuery.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No plans available yet.</p>
            )}
            <div className="space-y-3">
              {plansQuery.data?.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`w-full text-left p-4 rounded-xl border border-border transition-colors ${
                    selectedPlanId === plan.id ? "bg-muted" : "bg-card"
                  }`}
                >
                  <p className="font-medium text-foreground">Plan {plan.start_date}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.start_date} → {plan.end_date}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Plan details</h3>
              {planRowsQuery.isLoading && selectedPlanId && (
                <Skeleton className="h-28 w-full" />
              )}
              {!selectedPlanId && (
                <p className="text-sm text-muted-foreground">Select a plan to view details.</p>
              )}
              {planRowsQuery.data && (
                <div className="space-y-2">
                  {planRowsQuery.data.slice(0, 3).map((row) => (
                    <div key={row.id} className="text-sm text-muted-foreground">
                      {row.date}: {row.kcal} kcal
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-6">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Range: {range}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

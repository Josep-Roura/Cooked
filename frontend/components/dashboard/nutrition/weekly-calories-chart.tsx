"use client"

import { format, parseISO } from "date-fns"
import { Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import type { WeeklyNutritionDay } from "@/lib/db/types"

interface WeeklyCaloriesChartProps {
  days: WeeklyNutritionDay[]
  selectedDate: string
  isLoading: boolean
  onSelectDate: (date: string) => void
}

type ChartDatum = {
  date: string
  label: string
  displayLabel: string
  consumedKcal: number
  targetKcal: number | null
  remainingKcal: number
}

function buildChartData(days: WeeklyNutritionDay[]): ChartDatum[] {
  return days.map((day) => ({
    date: day.date,
    label: format(parseISO(day.date), "EEE"),
    displayLabel: format(parseISO(day.date), "EEE, MMM d"),
    consumedKcal: day.consumed.kcal,
    targetKcal: day.target?.kcal ?? null,
    remainingKcal:
      day.target?.kcal && day.target.kcal > day.consumed.kcal
        ? day.target.kcal - day.consumed.kcal
        : 0,
  }))
}

export function WeeklyCaloriesChart({ days, selectedDate, isLoading, onSelectDate }: WeeklyCaloriesChartProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const data = buildChartData(days)

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Weekly Calories</h3>
      <ChartContainer
        config={{
          consumed: { color: "hsl(142 72% 35%)" },
          remaining: { color: "hsl(142 45% 82%)" },
        }}
        className="h-64 w-full"
      >
        <BarChart data={data} margin={{ left: -16, right: 8 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis hide domain={[0, "dataMax + 200"]} />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const item = payload[0].payload as ChartDatum
              const percent = item.targetKcal ? Math.round((item.consumedKcal / item.targetKcal) * 100) : null
              return (
                <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold text-foreground">{item.displayLabel}</p>
                  <p className="text-muted-foreground">Consumed: {item.consumedKcal} kcal</p>
                  {item.targetKcal ? (
                    <>
                      <p className="text-muted-foreground">Target: {item.targetKcal} kcal</p>
                      <p className="text-muted-foreground">Progress: {percent ?? 0}%</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Target: N/A</p>
                  )}
                </div>
              )
            }}
          />
          <Bar
            dataKey="consumedKcal"
            stackId="kcal"
            radius={[8, 8, 0, 0]}
            onClick={(dataPoint) => onSelectDate((dataPoint as ChartDatum).date)}
          >
            {data.map((entry) => (
              <Cell
                key={entry.date}
                fill="hsl(142 72% 35%)"
                stroke={entry.date === selectedDate ? "#22c55e" : "transparent"}
                strokeWidth={entry.date === selectedDate ? 2 : 0}
              />
            ))}
          </Bar>
          <Bar
            dataKey="remainingKcal"
            stackId="kcal"
            radius={[8, 8, 0, 0]}
            onClick={(dataPoint) => onSelectDate((dataPoint as ChartDatum).date)}
          >
            {data.map((entry) => (
              <Cell
                key={`${entry.date}-remaining`}
                fill="hsl(142 45% 82%)"
                stroke="none"
                strokeWidth={0}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="text-xs text-muted-foreground mt-4">
        Dark green shows consumed calories. Light green shows remaining to target.
      </p>
    </div>
  )
}

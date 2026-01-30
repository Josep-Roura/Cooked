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
  targetKcal: number
  hasTarget: boolean
}

function buildChartData(days: WeeklyNutritionDay[]): ChartDatum[] {
  return days.map((day) => ({
    date: day.date,
    label: format(parseISO(day.date), "EEE"),
    displayLabel: format(parseISO(day.date), "EEE, MMM d"),
    consumedKcal: day.consumed.kcal,
    targetKcal: day.target?.kcal ?? 0,
    hasTarget: Boolean(day.target?.kcal),
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
          consumed: { color: "var(--primary)" },
          target: { color: "var(--primary)" },
        }}
        className="h-48 w-full"
      >
        <BarChart data={data} margin={{ left: -12, right: 8 }} barSize={26} barGap={-26} barCategoryGap={18}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis hide domain={[0, "dataMax + 200"]} />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const item = payload[0].payload as ChartDatum
              const percent = item.hasTarget ? Math.round((item.consumedKcal / item.targetKcal) * 100) : null
              return (
                <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold text-foreground">{item.displayLabel}</p>
                  <p className="text-muted-foreground">Consumed: {item.consumedKcal} kcal</p>
                  {item.hasTarget ? (
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
          <Bar dataKey="targetKcal" radius={[12, 12, 12, 12]}>
            {data.map((entry) => (
              <Cell
                key={`target-${entry.date}`}
                fill="var(--primary)"
                fillOpacity={entry.hasTarget ? 0.2 : 0.08}
              />
            ))}
          </Bar>
          <Bar
            dataKey="consumedKcal"
            radius={[12, 12, 12, 12]}
            onClick={(dataPoint) => onSelectDate((dataPoint as ChartDatum).date)}
          >
            {data.map((entry) => (
              <Cell
                key={entry.date}
                fill="var(--primary)"
                fillOpacity={entry.hasTarget ? 1 : 0.35}
                stroke={entry.date === selectedDate ? "var(--primary)" : "transparent"}
                strokeWidth={entry.date === selectedDate ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="text-xs text-muted-foreground mt-4">Bars show calories consumed against targets.</p>
    </div>
  )
}

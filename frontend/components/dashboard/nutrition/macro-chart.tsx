interface MacroChartProps {
  weeklyData: {
    targetCalories: number
    dailyData: Array<{
      dayLabel: string
      kcal: number
    }>
  }
}

export function MacroChart({ weeklyData }: MacroChartProps) {
  const maxCalories = Math.max(...weeklyData.dailyData.map((d) => d.kcal), 1)

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Weekly Calories</h3>
      <div className="flex items-end gap-3 h-40">
        {weeklyData.dailyData.map((day) => {
          const height = (day.kcal / maxCalories) * 100
          return (
            <div key={day.dayLabel} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full relative h-32 flex items-end justify-center">
                <div
                  className="w-full max-w-10 rounded-t-lg bg-primary"
                  style={{ height: `${height}%` }}
                />
                <div
                  className="absolute w-full border-t border-dashed border-muted-foreground/40"
                  style={{ bottom: `${(weeklyData.targetCalories / maxCalories) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{day.dayLabel}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mt-4">
        <span>Calories consumed</span>
        <span>Target ({weeklyData.targetCalories})</span>
      </div>
    </div>
  )
}

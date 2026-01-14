"use client"

interface MacroChartProps {
  weeklyData: {
    targetCalories: number
    dailyData: Array<{
      day: string
      calories: number
      protein: number
      carbs: number
      fat: number
    }>
  }
}

export function MacroChart({ weeklyData }: MacroChartProps) {
  const maxCalories = Math.max(...weeklyData.dailyData.map((d) => d.calories))

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Weekly Calories</h3>
      <div className="flex items-end gap-3 h-48">
        {weeklyData.dailyData.map((day, i) => {
          const height = (day.calories / maxCalories) * 100
          const isToday = i === 0

          return (
            <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full relative h-40 flex items-end">
                <div
                  className={`w-full rounded-t-lg transition-all duration-500 ${
                    isToday ? "bg-primary" : "bg-primary/30"
                  }`}
                  style={{ height: `${height}%` }}
                />
                {/* Target line */}
                <div
                  className="absolute w-full border-t-2 border-dashed border-muted-foreground/30"
                  style={{ bottom: `${(weeklyData.targetCalories / maxCalories) * 100}%` }}
                />
              </div>
              <span className={`text-xs ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
                {day.day}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary" />
          <span className="text-muted-foreground">Calories consumed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 border-t-2 border-dashed border-muted-foreground/30" />
          <span className="text-muted-foreground">Target ({weeklyData.targetCalories})</span>
        </div>
      </div>
    </div>
  )
}

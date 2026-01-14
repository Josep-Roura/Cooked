"use client"

interface WeeklyHistoryProps {
  weeklyData: {
    totalDuration: number
    totalCalories: number
    sessions: Array<{
      day: string
      type: string
      duration: number
      intensity: string
    }>
  }
}

const typeColors = {
  swim: "bg-cyan-500",
  bike: "bg-orange-500",
  run: "bg-green-500",
  strength: "bg-purple-500",
  rest: "bg-gray-400",
}

export function WeeklyHistory({ weeklyData }: WeeklyHistoryProps) {
  const maxDuration = Math.max(...weeklyData.sessions.map((s) => s.duration), 1)

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Weekly Training History</h3>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Total duration: </span>
            <span className="font-semibold text-foreground">
              {Math.round(weeklyData.totalDuration / 60)}h {weeklyData.totalDuration % 60}m
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Calories burned: </span>
            <span className="font-semibold text-foreground">{weeklyData.totalCalories.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex items-end gap-4 h-48 mb-4">
        {weeklyData.sessions.map((session, i) => {
          const height = session.duration > 0 ? (session.duration / maxDuration) * 100 : 5
          const isToday = i === 0

          return (
            <div key={session.day} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full relative h-40 flex items-end justify-center">
                <div
                  className={`w-full max-w-12 rounded-t-lg transition-all duration-500 ${
                    typeColors[session.type as keyof typeof typeColors] || "bg-gray-400"
                  } ${isToday ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <div className="text-center">
                <span className={`text-xs ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
                  {session.day}
                </span>
                {session.duration > 0 && <p className="text-xs text-muted-foreground">{session.duration}m</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-border">
        {Object.entries(typeColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${color}`} />
            <span className="text-xs text-muted-foreground capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

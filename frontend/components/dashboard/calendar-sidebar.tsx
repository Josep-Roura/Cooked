import { Calendar, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"

const scheduleData = [
  {
    date: null,
    showDateHeader: false,
    items: [
      {
        time: "09:00",
        color: "bg-cyan-400",
        title: "Swim training",
        subtitle: "Endurance - 75 min",
      },
      {
        time: "11:00",
        color: "bg-green-500",
        title: "Nutrition — Post - swim",
        subtitle: "60-70 g carbs - light digestion",
      },
    ],
  },
  {
    date: "16 October",
    showDateHeader: true,
    items: [
      {
        time: "09:00",
        color: "bg-gray-400",
        title: "Design",
        subtitle: "Sleep App",
      },
      {
        time: "15:00",
        color: "bg-green-500",
        title: "Animation",
        subtitle: "Create Post For App",
      },
    ],
  },
  {
    date: "17 October",
    showDateHeader: true,
    items: [
      {
        time: "09:00",
        color: "bg-orange-500",
        title: "Marketing",
        subtitle: "2 posts on instagram",
      },
      {
        time: "10:00",
        color: "bg-purple-500",
        title: "Animation",
        subtitle: "Platform App Concept",
      },
    ],
  },
]

export function DashboardCalendar() {
  return (
    <aside className="w-80 border-l border-border bg-background p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Calendar</h2>
        <Button size="icon" className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
          <Calendar className="h-5 w-5" />
        </Button>
      </div>

      {/* Morning Label */}
      <p className="text-sm text-muted-foreground mb-4">Morning</p>

      {/* Schedule */}
      <div className="space-y-6">
        {scheduleData.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            {section.showDateHeader && (
              <div className="flex items-center justify-between mb-4 mt-2">
                <h3 className="font-medium text-foreground">{section.date}</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="space-y-4">
              {section.items.map((item, itemIndex) => (
                <div key={itemIndex} className="flex items-start gap-4">
                  <span className="text-sm font-medium text-foreground w-12 pt-0.5">{item.time}</span>
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-1 h-10 ${item.color} rounded-full flex-shrink-0`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

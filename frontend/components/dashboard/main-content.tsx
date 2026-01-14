import { Search, Star, Diamond, Moon, Circle, Plus, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const tasks = [
  {
    icon: Star,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    title: "Marketing",
    subtitle: "Marketing - Viewed Just Now - Edited 15 min ago",
  },
  {
    icon: Diamond,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    title: "Developming",
    subtitle: "Developming - Viewed Just Now - Edited 10 min ago",
  },
  {
    icon: Moon,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    title: "Night Mode for Sleep app",
    subtitle: "Design - Viwed Just Now . Edited 45 min ago",
    showAdd: true,
  },
  {
    icon: Circle,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    title: "Animation",
    subtitle: "Motion Web . Viewed Just Now. Edited 1 hour ago",
  },
]

export function DashboardMain() {
  return (
    <main className="flex-1 p-8 bg-background overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground">15 October 2020</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">1 of 5 completed</span>
          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-primary rounded-full" />
          </div>
        </div>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Card 1 - Animate Platform */}
        <div className="bg-primary rounded-2xl p-6 h-52 relative overflow-hidden">
          {/* Abstract Design Elements */}
          <div className="absolute top-4 left-4 w-10 h-10 bg-primary-foreground/20 rounded-full" />
          <div className="absolute top-8 right-16 w-16 h-16 border-2 border-primary-foreground/30 rounded-full" />
          <svg
            className="absolute top-12 left-12 w-32 h-32 text-primary-foreground/20"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20,50 Q50,10 80,50 Q50,90 20,50" />
          </svg>
          <div className="absolute bottom-20 right-20">
            <svg className="w-20 h-20 text-primary-foreground/30" viewBox="0 0 100 100" fill="currentColor">
              <circle cx="50" cy="50" r="40" />
              <circle cx="50" cy="50" r="25" fill="#22c55e" />
            </svg>
          </div>
          <h3 className="absolute bottom-6 left-6 text-primary-foreground font-semibold text-lg">
            Animate
            <br />
            Platform app
          </h3>
        </div>

        {/* Card 2 - Night Mode */}
        <div className="bg-primary rounded-2xl p-6 h-52 relative overflow-hidden">
          {/* Moon Icon */}
          <div className="absolute top-4 left-4 w-12 h-12 bg-primary-foreground/20 rounded-xl flex items-center justify-center">
            <Moon className="h-6 w-6 text-primary-foreground" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10"
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
          {/* Abstract Shapes */}
          <div className="absolute bottom-16 right-8 w-24 h-16 bg-primary-foreground/20 rounded-lg transform rotate-12" />
          <div className="absolute bottom-8 right-24 w-20 h-12 bg-primary-foreground/15 rounded-lg transform -rotate-6" />
          {/* Accent Line */}
          <div className="absolute bottom-20 right-4 w-1 h-12 bg-cyan-400 rounded-full" />
          <h3 className="absolute bottom-6 left-6 text-primary-foreground font-semibold text-lg">
            Create Night Mode
            <br />
            For Sleep App
          </h3>
        </div>
      </div>

      {/* Weekly Tasks Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Weekly Tasks</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-full px-6 bg-transparent">
            Archive
          </Button>
          <Button className="rounded-full px-6 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search tasks" className="pl-10 bg-background border-border" />
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {tasks.map((task, index) => (
          <div key={index} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors group">
            <div className={`h-10 w-10 rounded-lg ${task.iconBg} flex items-center justify-center`}>
              <task.icon className={`h-5 w-5 ${task.iconColor}`} fill="currentColor" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-foreground">{task.title}</h4>
              <p className="text-sm text-muted-foreground">{task.subtitle}</p>
            </div>
            {task.showAdd && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}

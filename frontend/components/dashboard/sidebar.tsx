"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Calendar, ListTodo, Plus, MoreHorizontal, Utensils, Dumbbell, User, Settings } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const navItems = [
  { icon: Home, label: "Home", href: "/dashboard" },
  { icon: Calendar, label: "Calendar", href: "/dashboard/calendar" },
  { icon: ListTodo, label: "Tasks", href: "/dashboard/tasks", badge: 2 },
  { icon: Utensils, label: "Nutrition", href: "/dashboard/nutrition" },
  { icon: Dumbbell, label: "Training", href: "/dashboard/training" },
  { icon: User, label: "Profile", href: "/dashboard/profile" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
]

const categoryItems = [
  { label: "Directory", color: "bg-green-500" },
  { label: "Onbording", color: "bg-blue-400" },
  { label: "Offbording", color: "bg-blue-400" },
  { label: "Time-off", color: "bg-blue-400" },
]

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <TooltipProvider>
      <aside className="w-64 border-r border-border bg-background flex flex-col p-6">
        {/* User Profile */}
        <div className="flex items-center gap-3 mb-8">
          <Avatar className="h-12 w-12">
            <AvatarImage src="/man-with-sunglasses-professional-headshot.jpg" />
            <AvatarFallback>MT</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-foreground">Mike T.</h3>
            <p className="text-sm text-muted-foreground">Art Director</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1 mb-8">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
            return (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "text-foreground font-medium bg-muted"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        {/* Secondary User */}
        <div className="flex items-center gap-3 mb-6 mt-4">
          <Avatar className="h-10 w-10 bg-orange-100">
            <AvatarFallback className="bg-orange-400 text-white font-semibold">BA</AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground">Ben</span>
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Categories */}
        <div className="space-y-3">
          {categoryItems.map((item) => (
            <a
              key={item.label}
              href="#"
              className="flex items-center gap-3 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className={`h-2 w-2 rounded-full ${item.color}`} />
              <span>{item.label}</span>
            </a>
          ))}
        </div>

        {/* Add Button & Footer */}
        <div className="mt-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground mb-4"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add new item</p>
            </TooltipContent>
          </Tooltip>
          <p className="text-xs text-muted-foreground">2020 Teamwork License</p>
        </div>
      </aside>
    </TooltipProvider>
  )
}

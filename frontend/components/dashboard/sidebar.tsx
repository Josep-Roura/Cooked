"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Calendar, ListTodo, Plus, MoreHorizontal, Utensils, Dumbbell, User, Settings, Notebook } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useSession } from "@/hooks/use-session"
import { useProfile } from "@/lib/db/hooks"

const navItems = [
  { icon: Home, label: "Home", href: "/dashboard" },
  { icon: Dumbbell, label: "Training", href: "/dashboard/training" },
  { icon: Utensils, label: "Nutrition", href: "/dashboard/nutrition" },
  { icon: Notebook, label: "Plans", href: "/dashboard/plans" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
  { icon: Calendar, label: "Calendar", href: "/dashboard/calendar" },
  { icon: ListTodo, label: "Tasks", href: "/dashboard/tasks", badge: 2 },
  { icon: User, label: "Profile", href: "/dashboard/profile" },
]

const categoryItems = [
  { label: "Directory", color: "bg-green-500" },
  { label: "Onbording", color: "bg-blue-400" },
  { label: "Offbording", color: "bg-blue-400" },
  { label: "Time-off", color: "bg-blue-400" },
]

interface DashboardSidebarProps {
  onNavigate?: () => void
}

export function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname()
  const { user } = useSession()
  const profileQuery = useProfile(user?.id)

  const profileName = profileQuery.data?.full_name || profileQuery.data?.name || "Athlete"
  const profileRole = profileQuery.data?.experience_level || "Training"

  return (
    <TooltipProvider>
      <aside className="w-64 border-r border-border bg-background flex flex-col p-6">
        {/* User Profile */}
        <div className="flex items-center gap-3 mb-8">
          <Avatar className="h-12 w-12">
            <AvatarImage src={profileQuery.data?.avatar_url ?? undefined} />
            <AvatarFallback>
              {profileName
                .split(" ")
                .map((letter) => letter[0])
                .slice(0, 2)
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-foreground">{profileName}</h3>
            <p className="text-sm text-muted-foreground">{profileRole}</p>
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
                    onClick={onNavigate}
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

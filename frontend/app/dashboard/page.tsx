"use client"

import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardMain } from "@/components/dashboard/main-content"
import { DashboardCalendar } from "@/components/dashboard/calendar-sidebar"

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <DashboardMain />
      <DashboardCalendar />
    </div>
  )
}

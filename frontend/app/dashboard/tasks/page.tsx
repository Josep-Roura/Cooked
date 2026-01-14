"use client"

import { useState } from "react"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { TaskList } from "@/components/dashboard/tasks/task-list"
import { mockTasks, type Task } from "@/lib/mock-data"

export default function TasksPage() {
  const [tasks, setTasks] = useState(mockTasks)
  const [filter, setFilter] = useState<"all" | "training" | "nutrition" | "recovery">("all")

  const handleStatusChange = (taskId: string, status: Task["status"]) => {
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status } : t)))
  }

  const filteredTasks = filter === "all" ? tasks : tasks.filter((t) => t.category === filter)

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-8 overflow-auto">
        <TaskList
          tasks={filteredTasks}
          filter={filter}
          onFilterChange={setFilter}
          onStatusChange={handleStatusChange}
        />
      </main>
    </div>
  )
}

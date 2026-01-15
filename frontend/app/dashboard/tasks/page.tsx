"use client"

import { useState } from "react"
import { TaskList } from "@/components/dashboard/tasks/task-list"

interface TaskItem {
  id: string
  title: string
  category: "training" | "nutrition" | "recovery"
  priority: "low" | "medium" | "high"
  status: "pending" | "completed" | "skipped"
  dueDate: string
  description?: string
}

const initialTasks: TaskItem[] = []

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks)
  const [filter, setFilter] = useState<"all" | "training" | "nutrition" | "recovery">("all")

  const handleStatusChange = (taskId: string, status: TaskItem["status"]) => {
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status } : t)))
  }

  const filteredTasks = filter === "all" ? tasks : tasks.filter((t) => t.category === filter)

  return (
    <main className="flex-1 p-8 overflow-auto">
      <TaskList
        tasks={filteredTasks}
        filter={filter}
        onFilterChange={setFilter}
        onStatusChange={handleStatusChange}
      />
    </main>
  )
}

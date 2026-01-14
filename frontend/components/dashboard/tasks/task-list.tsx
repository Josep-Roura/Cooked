"use client"

import { Search, Plus, Check, X, Clock, MoreHorizontal, ListTodo } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Task } from "@/lib/mock-data"
import { EmptyState } from "@/components/ui/empty-state"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TaskListProps {
  tasks: Task[]
  filter: "all" | "training" | "nutrition" | "recovery"
  onFilterChange: (filter: "all" | "training" | "nutrition" | "recovery") => void
  onStatusChange: (taskId: string, status: Task["status"]) => void
}

const priorityColors = {
  low: "bg-gray-400",
  medium: "bg-yellow-500",
  high: "bg-red-500",
}

const statusColors = {
  pending: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  skipped: "bg-gray-100 text-gray-700",
}

const categoryIcons = {
  training: "🏃",
  nutrition: "🥗",
  recovery: "💤",
}

export function TaskList({ tasks, filter, onFilterChange, onStatusChange }: TaskListProps) {
  const filters = ["all", "training", "nutrition", "recovery"] as const

  return (
    <TooltipProvider>
      <div className="max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." className="pl-10 bg-background border-border" />
        </div>

        {/* Task List */}
        {tasks.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No tasks found"
            description="You don't have any tasks in this category. Create a new task to get started."
            actionLabel="Create Task"
            onAction={() => {}}
          />
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-4 p-4 rounded-xl border border-border bg-card transition-all hover:shadow-md ${
                  task.status === "completed" ? "opacity-60" : ""
                }`}
              >
                {/* Category Icon */}
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl">
                  {categoryIcons[task.category]}
                </div>

                {/* Task Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-medium text-foreground ${task.status === "completed" ? "line-through" : ""}`}>
                      {task.title}
                    </h3>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className={`h-2 w-2 rounded-full ${priorityColors[task.priority]}`} />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} priority</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[task.status]}`}>
                      {task.status}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {task.status === "pending" && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:bg-green-100"
                            onClick={() => onStatusChange(task.id, "completed")}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Complete task</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-600 hover:bg-gray-100"
                            onClick={() => onStatusChange(task.id, "skipped")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Skip task</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

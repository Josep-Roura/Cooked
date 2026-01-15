"use client"

import { useEffect, useMemo, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import type { EventCategory, ProfileEvent } from "@/lib/db/types"

interface EventManagementSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  events: ProfileEvent[]
  onRefresh: () => Promise<unknown>
}

const CATEGORY_LABELS: Record<EventCategory, string> = {
  race: "Race",
  test: "Test",
  other: "Other",
}

function toTimestamp(date: string, time: string | null) {
  const value = `${date}T${time ?? "23:59"}:00`
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

export function EventManagementSheet({ open, onOpenChange, events, onRefresh }: EventManagementSheetProps) {
  const { toast } = useToast()
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<EventCategory>("race")
  const [goal, setGoal] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => toTimestamp(a.date, a.time) - toTimestamp(b.date, b.time)),
    [events],
  )

  const resetForm = () => {
    setEditingEventId(null)
    setTitle("")
    setCategory("race")
    setGoal("")
    setDate("")
    setTime("")
    setNotes("")
    setError(null)
  }

  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open])

  const populateForm = (event: ProfileEvent) => {
    setEditingEventId(event.id)
    setTitle(event.title)
    setCategory(event.category)
    setGoal(event.goal ?? "")
    setDate(event.date)
    setTime(event.time ?? "")
    setNotes(event.notes ?? "")
    setError(null)
  }

  const validate = () => {
    if (title.trim().length < 2) {
      return "Title must be at least 2 characters."
    }
    if (!date) {
      return "Date is required."
    }
    return null
  }

  const handleSubmit = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const payload = {
        title: title.trim(),
        category,
        goal: goal.trim() || null,
        date,
        time: time || null,
        notes: notes.trim() || null,
      }
      const response = await fetch(editingEventId ? `/api/v1/events/${editingEventId}` : "/api/v1/events", {
        method: editingEventId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Failed to save event")
      }
      await onRefresh()
      resetForm()
      toast({ title: editingEventId ? "Event updated" : "Event created" })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save event"
      setError(message)
      toast({ title: "Unable to save event", description: message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (eventId: string) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/v1/events/${eventId}`, { method: "DELETE" })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Failed to delete event")
      }
      await onRefresh()
      if (editingEventId === eventId) {
        resetForm()
      }
      toast({ title: "Event deleted" })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete event"
      toast({ title: "Unable to delete event", description: message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Manage events</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">{editingEventId ? "Edit event" : "Add event"}</h4>
            {editingEventId && (
              <Button variant="ghost" className="text-xs" onClick={resetForm} type="button">
                Cancel edit
              </Button>
            )}
          </div>

          <div className="grid gap-3">
            <Input placeholder="Event title" value={title} onChange={(event) => setTitle(event.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select value={category} onValueChange={(value) => setCategory(value as EventCategory)}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Goal (optional)" value={goal} onChange={(event) => setGoal(event.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </div>
            <Textarea
              placeholder="Notes (optional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-20"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button onClick={handleSubmit} disabled={isSubmitting} type="button" className="rounded-full text-xs">
              {editingEventId ? "Save changes" : "Add event"}
            </Button>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">All events</h4>
          {sortedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet. Add your first event above.</p>
          ) : (
            sortedEvents.map((event) => (
              <div key={event.id} className="flex flex-col gap-2 border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {event.date} {event.time ? `· ${event.time}` : ""}
                    </p>
                    <p className="text-sm font-semibold text-foreground">{event.title}</p>
                    {event.goal && <p className="text-xs text-muted-foreground mt-1">{event.goal}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="rounded-full px-3 text-xs" onClick={() => populateForm(event)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full px-3 text-xs"
                      onClick={() => handleDelete(event.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[event.category]}</p>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

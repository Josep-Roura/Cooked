"use client"

import { X, Clock, Calendar, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CalendarEvent } from "@/lib/mock-data"

interface EventDetailModalProps {
  event: CalendarEvent | null
  onClose: () => void
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  if (!event) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-md p-6 m-4">
        <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>

        <div className={`w-12 h-12 rounded-xl ${event.color} flex items-center justify-center mb-4`}>
          <Calendar className="h-6 w-6 text-white" />
        </div>

        <h2 className="text-xl font-bold text-foreground mb-2">{event.title}</h2>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {event.startTime} - {event.endTime}
            </span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {new Date(event.date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Tag className="h-4 w-4" />
            <span className="capitalize">{event.type}</span>
          </div>
        </div>

        {event.description && (
          <div className="p-4 bg-muted rounded-xl mb-6">
            <p className="text-sm text-foreground">{event.description}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 bg-transparent" onClick={onClose}>
            Close
          </Button>
          <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">Edit Event</Button>
        </div>
      </div>
    </div>
  )
}

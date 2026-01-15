"use client"

import { X, Calendar, Clock, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import type { CalendarEvent } from "@/lib/db/types"

interface EventDetailModalProps {
  event: CalendarEvent | null
  onClose: () => void
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        {event && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{event.title}</h3>
                <p className="text-sm text-muted-foreground capitalize">{event.type} session</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {event.date}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {event.startTime} - {event.endTime}
              </div>
              {event.description && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {event.description}
                </div>
              )}
            </div>

            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">View details</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

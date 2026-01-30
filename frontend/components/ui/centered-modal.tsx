"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface CenteredModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string | null
  children: React.ReactNode
  className?: string
}

export function CenteredModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: CenteredModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-[720px] bg-background/95 border-border/60 rounded-2xl shadow-xl p-6 sm:p-8",
          className,
        )}
      >
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-semibold text-foreground">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">{children}</div>
      </DialogContent>
    </Dialog>
  )
}

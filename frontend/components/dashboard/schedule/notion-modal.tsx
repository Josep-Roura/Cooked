"use client"

import { ReactNode } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface NotionModalProps {
  open: boolean
  title: string
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

export function NotionModal({ open, title, onOpenChange, children }: NotionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-3xl rounded-3xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-2">{children}</div>
      </DialogContent>
    </Dialog>
  )
}

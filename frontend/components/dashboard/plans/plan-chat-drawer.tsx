"use client"

import * as React from "react"
import { RotateCcw } from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { PlanChatMessage, PlanChatThread } from "@/lib/db/types"

interface PlanChatDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  weekLabel: string
  isLoading: boolean
  thread: PlanChatThread | null
  messages: PlanChatMessage[]
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onReset: () => void
  isSending: boolean
}

export function PlanChatDrawer({
  open,
  onOpenChange,
  weekLabel,
  isLoading,
  thread,
  messages,
  input,
  onInputChange,
  onSend,
  onReset,
  isSending,
}: PlanChatDrawerProps) {
  const [resetOpen, setResetOpen] = React.useState(false)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Plan chat · {weekLabel}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex-1 overflow-y-auto space-y-3">
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No messages yet. Ask for changes to your weekly meal plan.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-xl border border-border px-3 py-2 text-sm ${
                    message.role === "user" ? "bg-primary/10 text-foreground" : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    {message.role}
                  </p>
                  <p>{message.content}</p>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 space-y-2">
            <Input
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder="Ask to modify the plan..."
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                className="rounded-full text-xs"
                onClick={() => setResetOpen(true)}
                disabled={!thread?.id}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset chat
              </Button>
              <Button className="rounded-full text-xs" onClick={onSend} disabled={isSending}>
                Send
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset chat for this week?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all messages tied to the selected week.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onReset()
                setResetOpen(false)
              }}
            >
              Reset chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

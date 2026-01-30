"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { PlanChatMessage } from "@/lib/db/types"

interface NutritionChatDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  weekLabel: string
  isLoading: boolean
  messages: PlanChatMessage[]
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  isSending: boolean
  pendingDiff: Record<string, unknown> | null
  onApply: () => void
}

function formatMessageContent(content: unknown) {
  if (typeof content === "string") return content
  try {
    return JSON.stringify(content, null, 2)
  } catch {
    return String(content)
  }
}

function summarizeDiff(diff: Record<string, unknown> | null) {
  if (!diff) return null
  const parts: string[] = []
  const mealsAdded = diff.meals_added
  const mealsUpdated = diff.meals_updated
  const mealsRemoved = diff.meals_removed
  if (typeof mealsAdded === "number") parts.push(`${mealsAdded} meals added`)
  if (typeof mealsUpdated === "number") parts.push(`${mealsUpdated} meals updated`)
  if (typeof mealsRemoved === "number") parts.push(`${mealsRemoved} meals removed`)
  return parts.length ? parts.join(" · ") : "Updates ready"
}

export function NutritionChatDrawer({
  open,
  onOpenChange,
  weekLabel,
  isLoading,
  messages,
  input,
  onInputChange,
  onSend,
  isSending,
  pendingDiff,
  onApply,
}: NutritionChatDrawerProps) {
  const diffSummary = summarizeDiff(pendingDiff)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Nutrition chat · {weekLabel}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex-1 overflow-y-auto space-y-3">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ask for meal swaps, timing changes, or recipe tweaks. The assistant will apply updates.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl border border-border px-3 py-2 text-sm whitespace-pre-line ${
                  message.role === "user" ? "bg-primary/10 text-foreground" : "bg-muted/40 text-muted-foreground"
                }`}
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  {message.role}
                </p>
                <p>{formatMessageContent(message.content)}</p>
              </div>
            ))
          )}
        </div>
        {pendingDiff && (
          <div className="mt-4 rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground">Ready to apply</p>
            <p className="text-sm font-semibold text-foreground">{diffSummary}</p>
            <Button className="mt-2 w-full" onClick={onApply}>
              Apply updates
            </Button>
          </div>
        )}
        <div className="mt-4 space-y-2">
          <Input
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Ask to adapt a recipe or timing..."
          />
          <Button className="rounded-full text-xs" onClick={onSend} disabled={isSending}>
            Send
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

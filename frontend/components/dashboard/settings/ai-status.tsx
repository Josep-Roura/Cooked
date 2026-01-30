"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { PlanChatDrawer } from "@/components/dashboard/plans/plan-chat-drawer"
import { Badge } from "@/components/ui/badge"
import { useAiStatus, usePlanChat, useResetPlanChat, useSendPlanChatMessage, useWeekRange } from "@/lib/db/hooks"
import { ensureNutritionPlanRange } from "@/lib/nutrition/ensure"
import { useSession } from "@/hooks/use-session"

export function AiStatusCard() {
  const { user } = useSession()
  const { toast } = useToast()
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const statusQuery = useAiStatus(user?.id)
  const { startKey, endKey } = useWeekRange(new Date())
  const chatQuery = usePlanChat(user?.id, startKey, endKey)
  const sendChatMutation = useSendPlanChatMessage(user?.id, startKey, endKey)
  const resetChatMutation = useResetPlanChat(user?.id, startKey, endKey)

  const lastRun = statusQuery.data?.last_run ?? null
  const lastRunTime = lastRun?.created_at ? format(new Date(lastRun.created_at), "PPpp") : "No runs yet"
  const lastError = lastRun?.error_code ?? null
  const statusLabel = lastError ? "Failed" : "Healthy"
  const isLocalEnv = useMemo(() => process.env.NEXT_PUBLIC_APP_ENV === "local", [])

  const handleGenerate = async () => {
    setIsRegenerating(true)
    try {
      await ensureNutritionPlanRange({ start: startKey, end: endKey, force: true })
      await statusQuery.refetch()
      toast({ title: "Plan generation started", description: "We’re refreshing your plan now." })
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Unable to regenerate the plan.",
        variant: "destructive",
      })
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleSendChat = () => {
    if (!chatInput.trim()) return
    sendChatMutation.mutate(chatInput.trim(), {
      onSuccess: () => {
        setChatInput("")
      },
      onError: (error) => {
        toast({
          title: "Chat failed",
          description: error instanceof Error ? error.message : "Unable to send message.",
          variant: "destructive",
        })
      },
    })
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">AI status</h3>
          <p className="text-xs text-muted-foreground">Latest AI generation health.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isRegenerating}>
          Retry last week generation
        </Button>
      </div>

      {statusQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Last run</span>
            <span className="text-foreground">{lastRunTime}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Model</span>
            <span className="text-foreground">{lastRun?.model ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Latency</span>
            <span className="text-foreground">{lastRun?.latency_ms ? `${lastRun.latency_ms} ms` : "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Status</span>
            <Badge variant={lastError ? "destructive" : "secondary"}>{statusLabel}</Badge>
          </div>
          {lastError && (
            <p className="text-xs text-rose-600">
              Something went wrong with the last run. Try retrying the generation or open plan chat.
            </p>
          )}
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setChatOpen(true)}>
              Open plan chat
            </Button>
            {isLocalEnv && lastRun ? (
              <Button variant="ghost" size="sm" onClick={() => setDetailsOpen((prev) => !prev)}>
                {detailsOpen ? "Hide details" : "View details"}
              </Button>
            ) : null}
          </div>
          {isLocalEnv && detailsOpen && lastRun ? (
            <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground">Debug (local only)</p>
              <p>Prompt hash: {lastRun.prompt_hash ?? "—"}</p>
              {lastRun.prompt_preview && <p>Prompt preview: {lastRun.prompt_preview}</p>}
              {lastRun.response_preview && <p>Response preview: {lastRun.response_preview}</p>}
            </div>
          ) : null}
        </div>
      )}

      <PlanChatDrawer
        open={chatOpen}
        onOpenChange={setChatOpen}
        weekLabel={`${format(new Date(startKey), "MMM d")} – ${format(new Date(endKey), "MMM d, yyyy")}`}
        isLoading={chatQuery.isLoading}
        thread={chatQuery.data?.thread ?? null}
        messages={chatQuery.data?.messages ?? []}
        input={chatInput}
        onInputChange={setChatInput}
        onSend={handleSendChat}
        onReset={() => {
          const threadId = chatQuery.data?.thread?.id
          if (!threadId) return
          resetChatMutation.mutate(threadId)
        }}
        isSending={sendChatMutation.isPending}
        onApply={() => statusQuery.refetch()}
      />
    </div>
  )
}

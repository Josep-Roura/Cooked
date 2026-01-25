"use client"

import { useMemo, useState } from "react"
import { addWeeks, eachDayOfInterval, endOfWeek, format, isSameDay, startOfWeek } from "date-fns"
import { Calendar, ChevronLeft, ChevronRight, MessageCircle, RotateCcw } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useToast } from "@/components/ui/use-toast"
import { useSession } from "@/hooks/use-session"
import { usePlanChat, usePlanWeek, useResetPlanChat, useSendPlanChatMessage } from "@/lib/db/hooks"
import type { MealScheduleItem } from "@/lib/db/types"

const mealSlots = [
  { slot: 1, label: "Breakfast" },
  { slot: 2, label: "Lunch" },
  { slot: 3, label: "Dinner" },
  { slot: 4, label: "Snack" },
]

function formatMacro(label: string, value: number) {
  return `${label}${value}`
}

export default function PlansPage() {
  const { user } = useSession()
  const { toast } = useToast()
  const [anchorDate, setAnchorDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [resetOpen, setResetOpen] = useState(false)

  const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(anchorDate, { weekStartsOn: 1 })
  const weekStartKey = format(weekStart, "yyyy-MM-dd")
  const weekEndKey = format(weekEnd, "yyyy-MM-dd")
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`

  const weekMealsQuery = usePlanWeek(user?.id, weekStartKey, weekEndKey)
  const chatQuery = usePlanChat(user?.id, weekStartKey)
  const sendChatMutation = useSendPlanChatMessage(user?.id, weekStartKey)
  const resetChatMutation = useResetPlanChat(user?.id, weekStartKey)

  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])

  const mealsByDate = useMemo(() => {
    const map = new Map<string, MealScheduleItem[]>()
    ;(weekMealsQuery.data ?? []).forEach((meal) => {
      if (!map.has(meal.date)) {
        map.set(meal.date, [])
      }
      map.get(meal.date)?.push(meal)
    })
    map.forEach((items) => items.sort((a, b) => a.slot - b.slot))
    return map
  }, [weekMealsQuery.data])

  const weeklyTotals = useMemo(() => {
    return (weekMealsQuery.data ?? []).reduce(
      (acc, meal) => {
        acc.kcal += meal.kcal ?? 0
        acc.protein += meal.protein_g ?? 0
        acc.carbs += meal.carbs_g ?? 0
        acc.fat += meal.fat_g ?? 0
        return acc
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    )
  }, [weekMealsQuery.data])

  const handleSendChat = async () => {
    if (!chatInput.trim()) return
    try {
      await sendChatMutation.mutateAsync(chatInput.trim())
      setChatInput("")
    } catch (error) {
      toast({
        title: "Message failed",
        description: error instanceof Error ? error.message : "Unable to send message.",
        variant: "destructive",
      })
    }
  }

  const handleResetChat = async () => {
    if (!chatQuery.data?.thread?.id) return
    try {
      await resetChatMutation.mutateAsync(chatQuery.data.thread.id)
      setResetOpen(false)
      toast({ title: "Chat cleared", description: "This week’s chat has been reset." })
    } catch (error) {
      toast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : "Unable to reset chat.",
        variant: "destructive",
      })
    }
  }

  if (weekMealsQuery.isError || chatQuery.isError) {
    return <ErrorState onRetry={() => {
      weekMealsQuery.refetch()
      chatQuery.refetch()
    }} />
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Plans</h1>
            <p className="text-sm text-muted-foreground">Weekly meal plan viewer</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setAnchorDate(addWeeks(anchorDate, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-4 text-xs"
              onClick={() => setAnchorDate(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            >
              This week
            </Button>
            <Button variant="outline" size="icon" onClick={() => setAnchorDate(addWeeks(anchorDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {weekLabel}
            </div>
            <Button className="rounded-full text-xs" onClick={() => setChatOpen(true)}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Open plan chat
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd")
            const meals = mealsByDate.get(dateKey) ?? []
            const dayTotals = meals.reduce(
              (acc, meal) => {
                acc.kcal += meal.kcal ?? 0
                acc.protein += meal.protein_g ?? 0
                acc.carbs += meal.carbs_g ?? 0
                acc.fat += meal.fat_g ?? 0
                return acc
              },
              { kcal: 0, protein: 0, carbs: 0, fat: 0 },
            )

            return (
              <Card key={dateKey} className={`${isSameDay(day, new Date()) ? "border-primary/60" : ""}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{format(day, "EEE")}</span>
                    <span className="text-xs text-muted-foreground">{format(day, "MMM d")}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {weekMealsQuery.isLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : meals.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No meals planned for this day.</p>
                  ) : (
                    <div className="space-y-3">
                      {mealSlots.map((slot) => {
                        const slotMeals = meals.filter((meal) => meal.slot === slot.slot)
                        if (slotMeals.length === 0) {
                          return (
                            <div key={slot.slot} className="text-xs text-muted-foreground">
                              {slot.label}: <span className="text-muted-foreground/70">No meal</span>
                            </div>
                          )
                        }
                        return (
                          <div key={slot.slot} className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">{slot.label}</p>
                            {slotMeals.map((meal) => (
                              <Accordion key={meal.id} type="single" collapsible>
                                <AccordionItem value={meal.id} className="border border-border rounded-xl px-3">
                                  <AccordionTrigger className="hover:no-underline">
                                    <div className="flex flex-col text-left gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-base">{meal.emoji ?? "🥗"}</span>
                                        <span className="text-sm font-medium text-foreground">{meal.name}</span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                        <span>{meal.time ?? "Any time"}</span>
                                        <Badge variant="secondary" className="text-[10px]">
                                          {meal.kcal} kcal
                                        </Badge>
                                        <Badge variant="secondary" className="text-[10px]">
                                          {formatMacro("P", meal.protein_g ?? 0)}g
                                        </Badge>
                                        <Badge variant="secondary" className="text-[10px]">
                                          {formatMacro("C", meal.carbs_g ?? 0)}g
                                        </Badge>
                                        <Badge variant="secondary" className="text-[10px]">
                                          {formatMacro("F", meal.fat_g ?? 0)}g
                                        </Badge>
                                      </div>
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="text-xs text-muted-foreground space-y-2">
                                      {(Array.isArray(meal.ingredients) && meal.ingredients.length > 0) ? (
                                        <ul className="list-disc list-inside space-y-1">
                                          {meal.ingredients.map((ingredient, index) => (
                                            <li key={`${meal.id}-ingredient-${index}`}>{String(ingredient)}</li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p>No ingredients listed.</p>
                                      )}
                                      {meal.notes && <p>{meal.notes}</p>}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="border-t border-border/60 pt-2 text-xs text-muted-foreground">
                    <div className="flex flex-wrap gap-2">
                      <span>{dayTotals.kcal} kcal</span>
                      <span>P {dayTotals.protein}g</span>
                      <span>C {dayTotals.carbs}g</span>
                      <span>F {dayTotals.fat}g</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div className="sticky bottom-6 mt-8">
        <div className="max-w-6xl mx-auto bg-card border border-border rounded-full px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="text-xs text-muted-foreground">Weekly totals</div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Badge variant="secondary">{weeklyTotals.kcal} kcal</Badge>
            <Badge variant="secondary">P {weeklyTotals.protein}g</Badge>
            <Badge variant="secondary">C {weeklyTotals.carbs}g</Badge>
            <Badge variant="secondary">F {weeklyTotals.fat}g</Badge>
          </div>
        </div>
      </div>

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Plan chat · {weekLabel}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex-1 overflow-y-auto space-y-3">
            {chatQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (chatQuery.data?.messages?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No messages yet. Ask for changes to your weekly meal plan.
              </p>
            ) : (
              chatQuery.data?.messages.map((message) => (
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
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Ask to modify the plan..."
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                className="rounded-full text-xs"
                onClick={() => setResetOpen(true)}
                disabled={!chatQuery.data?.thread?.id}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset chat
              </Button>
              <Button
                className="rounded-full text-xs"
                onClick={handleSendChat}
                disabled={sendChatMutation.isPending}
              >
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
            <AlertDialogAction onClick={handleResetChat}>Reset chat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

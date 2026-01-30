"use client"

import { addDays, format } from "date-fns"
import { ProfileInfo } from "@/components/dashboard/profile/profile-info"
import { SubscriptionStatus } from "@/components/dashboard/profile/subscription-status"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfile, useTrainingSessions, useUserEvents, useWeekRange } from "@/lib/db/hooks"
import type { TrainingType } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"

export default function ProfilePage() {
  const { user } = useSession()
  const profileQuery = useProfile(user?.id)
  const { startKey, endKey } = useWeekRange(new Date())
  const trainingQuery = useTrainingSessions(user?.id, startKey, endKey)
  const eventsQuery = useUserEvents(
    user?.id,
    format(new Date(), "yyyy-MM-dd"),
    format(addDays(new Date(), 365), "yyyy-MM-dd"),
  )

  if (profileQuery.isError) {
    return <ErrorState onRetry={() => profileQuery.refetch()} />
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">Profile</h1>

        <div className="space-y-6">
          {profileQuery.isLoading && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {profileQuery.data && (
            <>
              <ProfileInfo profile={profileQuery.data} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Nutrition & Preferences</h2>
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div>
                      <p className="text-xs uppercase tracking-wide">Goal</p>
                      <p className="text-foreground">{profileQuery.data.primary_goal ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide">Diet</p>
                      <p className="text-foreground">{profileQuery.data.diet ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide">Meals per day</p>
                      <p className="text-foreground">{profileQuery.data.meals_per_day ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide">Cuisine</p>
                      <p className="text-foreground">{profileQuery.data.preferred_cuisine ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide">Allergies</p>
                      <p className="text-foreground">
                        {profileQuery.data.allergies_restrictions?.join(", ") ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide">Cooking style</p>
                      <p className="text-foreground">{profileQuery.data.cooking_time_preference ?? "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Training context</h2>
                  {trainingQuery.isLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    (() => {
                      const sessions = trainingQuery.data ?? []
                      const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0)
                      const totalsByType = sessions.reduce<Record<TrainingType, number>>(
                        (acc, session) => {
                          acc[session.type] = (acc[session.type] ?? 0) + 1
                          return acc
                        },
                        { swim: 0, bike: 0, run: 0, strength: 0, rest: 0, other: 0 },
                      )
                      return (
                        <div className="space-y-3 text-sm text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>Weekly hours</span>
                            <span className="text-foreground">
                              {(totalMinutes / 60).toFixed(1)}h
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Sessions</span>
                            <span className="text-foreground">{sessions.length}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(totalsByType)
                              .filter(([, count]) => count > 0)
                              .map(([type, count]) => (
                                <span key={type} className="text-xs bg-muted rounded-full px-3 py-1">
                                  {type} · {count}
                                </span>
                              ))}
                          </div>
                        </div>
                      )
                    })()
                  )}
                </div>
              </div>

              {eventsQuery.data?.length ? (
                <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
                  <h2 className="text-lg font-semibold text-foreground">Goals & Events</h2>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {eventsQuery.data.slice(0, 4).map((event) => (
                      <div key={event.id} className="flex items-center justify-between">
                        <span className="text-foreground">{event.title}</span>
                        <span>{format(new Date(`${event.date}T00:00:00`), "MMM d, yyyy")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <SubscriptionStatus profile={profileQuery.data} />
            </>
          )}
        </div>
      </div>
    </main>
  )
}

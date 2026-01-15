"use client"

import { ProfileInfo } from "@/components/dashboard/profile/profile-info"
import { SubscriptionStatus } from "@/components/dashboard/profile/subscription-status"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfile } from "@/lib/db/hooks"
import { useSession } from "@/hooks/use-session"

export default function ProfilePage() {
  const { user } = useSession()
  const profileQuery = useProfile(user?.id)

  if (profileQuery.isError) {
    return <ErrorState onRetry={() => profileQuery.refetch()} />
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-3xl">
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
              <SubscriptionStatus profile={profileQuery.data} />
            </>
          )}
        </div>
      </div>
    </main>
  )
}

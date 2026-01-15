"use client"

import { Settings, Sparkles } from "lucide-react"
import { ProfilePreferences } from "@/components/dashboard/profile/profile-preferences"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfile } from "@/lib/db/hooks"
import { useSession } from "@/hooks/use-session"

export default function SettingsPage() {
  const { user } = useSession()
  const profileQuery = useProfile(user?.id)

  if (profileQuery.isError) {
    return <ErrorState onRetry={() => profileQuery.refetch()} />
  }

  const preferences = profileQuery.data
    ? {
        darkMode: false,
        units: profileQuery.data.units ?? "metric",
        notifications: true,
      }
    : null

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your preferences and connected accounts.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {profileQuery.isLoading && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
          {preferences && <ProfilePreferences preferences={preferences} />}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">Integrations</h3>
            <p className="text-sm text-muted-foreground">
              Connect devices and services to sync training load automatically.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Coming soon
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

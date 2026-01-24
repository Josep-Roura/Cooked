"use client"

import { Settings } from "lucide-react"
import { ProfilePreferences } from "@/components/dashboard/profile/profile-preferences"
import { TrainingPeaksCsvImport } from "@/components/dashboard/settings/trainingpeaks-csv-import"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { usePreferences, useUpdatePreferences } from "@/lib/db/hooks"
import { useSession } from "@/hooks/use-session"

export default function SettingsPage() {
  const { user } = useSession()
  const { toast } = useToast()
  const preferencesQuery = usePreferences(user?.id)
  const updatePreferences = useUpdatePreferences(user?.id)

  if (preferencesQuery.isError) {
    return <ErrorState onRetry={() => preferencesQuery.refetch()} />
  }

  const preferences = preferencesQuery.data ?? null

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
          {preferencesQuery.isLoading && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
          {preferences && (
            <ProfilePreferences
              preferences={preferences}
              isSaving={updatePreferences.isPending}
              onUpdate={(payload) =>
                updatePreferences.mutate(payload, {
                  onSuccess: () => toast({ title: "Preferences updated" }),
                  onError: (error) =>
                    toast({
                      title: "Failed to save settings",
                      description: error instanceof Error ? error.message : "Please try again.",
                      variant: "destructive",
                    }),
                })
              }
            />
          )}
          <TrainingPeaksCsvImport />
        </div>
      </div>
    </main>
  )
}

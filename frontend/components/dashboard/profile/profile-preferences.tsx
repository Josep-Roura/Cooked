"use client"

import { Moon, Sun, Ruler, Bell } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import type { UserProfile } from "@/lib/mock-data"

interface ProfilePreferencesProps {
  profile: UserProfile
}

export function ProfilePreferences({ profile }: ProfilePreferencesProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Preferences</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
          <div className="flex items-center gap-3">
            {profile.preferences.darkMode ? (
              <Moon className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Sun className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium text-foreground">Dark Mode</p>
              <p className="text-sm text-muted-foreground">Switch between light and dark theme</p>
            </div>
          </div>
          <Switch checked={profile.preferences.darkMode} />
        </div>

        <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
          <div className="flex items-center gap-3">
            <Ruler className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Units</p>
              <p className="text-sm text-muted-foreground">Currently using {profile.preferences.units} system</p>
            </div>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${
                profile.preferences.units === "metric"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }`}
            >
              Metric
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${
                profile.preferences.units === "imperial"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }`}
            >
              Imperial
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Notifications</p>
              <p className="text-sm text-muted-foreground">Receive training and nutrition reminders</p>
            </div>
          </div>
          <Switch checked={profile.preferences.notifications} />
        </div>
      </div>
    </div>
  )
}

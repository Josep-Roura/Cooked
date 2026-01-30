"use client"

import { useEffect } from "react"
import { Moon, Sun, Ruler, Bell } from "lucide-react"
import { useTheme } from "next-themes"
import { Switch } from "@/components/ui/switch"

interface ProfilePreferencesProps {
  preferences: {
    theme: "light" | "dark"
    units: "metric" | "imperial"
    notifications_enabled: boolean
  }
  isSaving: boolean
  onUpdate: (payload: Partial<{ theme: "light" | "dark"; units: "metric" | "imperial"; notifications_enabled: boolean }>) => void
}

export function ProfilePreferences({ preferences, isSaving, onUpdate }: ProfilePreferencesProps) {
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark"

  useEffect(() => {
    if (preferences.theme && theme !== preferences.theme) {
      setTheme(preferences.theme)
    }
  }, [preferences.theme, setTheme, theme])

  const handleThemeToggle = (checked: boolean) => {
    const nextTheme = checked ? "dark" : "light"
    setTheme(nextTheme)
    onUpdate({ theme: nextTheme })
  }

  const handleUnitsChange = (units: "metric" | "imperial") => {
    if (units === preferences.units) return
    onUpdate({ units })
  }

  const handleNotificationsToggle = (checked: boolean) => {
    onUpdate({ notifications_enabled: checked })
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Preferences</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
          <div className="flex items-center gap-3">
            {isDark ? (
              <Moon className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Sun className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium text-foreground">Dark Mode</p>
              <p className="text-sm text-muted-foreground">Switch between light and dark theme</p>
            </div>
          </div>
          <Switch checked={isDark} onCheckedChange={handleThemeToggle} disabled={isSaving} />
        </div>

        <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
          <div className="flex items-center gap-3">
            <Ruler className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Units</p>
              <p className="text-sm text-muted-foreground">Currently using {preferences.units} system</p>
            </div>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${
                preferences.units === "metric"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }`}
              type="button"
              onClick={() => handleUnitsChange("metric")}
              disabled={isSaving}
            >
              Metric
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${
                preferences.units === "imperial"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }`}
              type="button"
              onClick={() => handleUnitsChange("imperial")}
              disabled={isSaving}
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
          <Switch
            checked={preferences.notifications_enabled}
            onCheckedChange={handleNotificationsToggle}
            disabled={isSaving}
          />
        </div>
      </div>
    </div>
  )
}

"use client"

import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { ProfilePreferences } from "@/components/dashboard/profile/profile-preferences"
import { mockUserProfile } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { LogOut, Trash2, Download, Shield } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

          <div className="space-y-6">
            <ProfilePreferences profile={mockUserProfile} />

            {/* Data Management */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Data Management</h3>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start gap-3 bg-transparent">
                  <Download className="h-4 w-4" />
                  Export My Data
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3 bg-transparent">
                  <Shield className="h-4 w-4" />
                  Privacy Settings
                </Button>
              </div>
            </div>

            {/* Account Actions */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Account</h3>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start gap-3 text-muted-foreground bg-transparent">
                  <LogOut className="h-4 w-4" />
                  Log Out
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10 bg-transparent"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

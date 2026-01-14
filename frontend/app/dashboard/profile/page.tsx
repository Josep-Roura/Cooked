"use client"

import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { ProfileInfo } from "@/components/dashboard/profile/profile-info"
import { SubscriptionStatus } from "@/components/dashboard/profile/subscription-status"
import { mockUserProfile } from "@/lib/mock-data"

export default function ProfilePage() {
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold text-foreground mb-6">Profile</h1>

          <div className="space-y-6">
            <ProfileInfo profile={mockUserProfile} />
            <SubscriptionStatus profile={mockUserProfile} />
          </div>
        </div>
      </main>
    </div>
  )
}

"use client"

import { Crown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ProfileRow } from "@/lib/db/types"

interface SubscriptionStatusProps {
  profile: ProfileRow
}

const planFeatures = {
  free: ["Basic nutrition tracking", "Weekly training summaries", "Limited meal suggestions"],
  pro: [
    "Advanced nutrition analytics",
    "Daily personalized meals",
    "Training-nutrition optimization",
    "Priority support",
  ],
  team: [
    "Everything in Pro",
    "Team collaboration",
    "Coach dashboard",
    "Custom integrations",
    "Dedicated account manager",
  ],
}

const planColors = {
  free: "bg-gray-100 text-gray-700",
  pro: "bg-primary/10 text-primary",
  team: "bg-purple-100 text-purple-700",
}

export function SubscriptionStatus({ profile }: SubscriptionStatusProps) {
  const subscription = (profile.meta?.subscription_status as keyof typeof planFeatures | undefined) ?? "free"
  const features = planFeatures[subscription] ?? planFeatures.free

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${planColors[subscription]}`}>
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground capitalize">{subscription} Plan</h3>
            {profile.meta?.subscription_expiry && (
              <p className="text-sm text-muted-foreground">
                Renews on{" "}
                {new Date(profile.meta.subscription_expiry as string).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
        {subscription !== "team" && (
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Upgrade Plan</Button>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground mb-3">Your plan includes:</p>
        {features.map((feature) => (
          <div key={feature} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm text-foreground">{feature}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

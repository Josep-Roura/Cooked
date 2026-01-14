"use client"

import { Mail, Scale, Target, Edit2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { UserProfile } from "@/lib/mock-data"

interface ProfileInfoProps {
  profile: UserProfile
}

export function ProfileInfo({ profile }: ProfileInfoProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar || "/placeholder.svg"} />
            <AvatarFallback>
              {profile.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold text-foreground">{profile.name}</h2>
            <p className="text-muted-foreground">{profile.role}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2 bg-transparent">
          <Edit2 className="h-4 w-4" />
          Edit Profile
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-4 bg-muted rounded-xl">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm font-medium text-foreground">{profile.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-muted rounded-xl">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Weight</p>
            <p className="text-sm font-medium text-foreground">
              {profile.weight} {profile.weightUnit}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-muted rounded-xl">
          <Target className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Goal</p>
            <p className="text-sm font-medium text-foreground">{profile.goal}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { Mail, Scale, Target, Edit2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/components/ui/use-toast"
import type { ProfileRow, Units } from "@/lib/db/types"

interface ProfileInfoProps {
  profile: ProfileRow
}

type ProfileFormState = {
  full_name: string
  avatar_url: string
  height_cm: string
  weight_kg: string
  units: Units
  primary_goal: string
  experience_level: string
  event: string
  sports: string
  workout_time: string
  diet: string
  meals_per_day: string
  cooking_time_min: string
  budget: string
  kitchen: string
}

const DEFAULT_UNITS: Units = "metric"

function buildFormState(profile: ProfileRow): ProfileFormState {
  return {
    full_name: profile.full_name ?? profile.name ?? "",
    avatar_url: profile.avatar_url ?? "",
    height_cm: profile.height_cm?.toString() ?? "",
    weight_kg: profile.weight_kg?.toString() ?? "",
    units: profile.units ?? DEFAULT_UNITS,
    primary_goal: profile.primary_goal ?? "",
    experience_level: profile.experience_level ?? "",
    event: profile.event ?? "",
    sports: profile.sports?.join(", ") ?? "",
    workout_time: profile.workout_time ?? "",
    diet: profile.diet ?? "",
    meals_per_day: profile.meals_per_day?.toString() ?? "",
    cooking_time_min: profile.cooking_time_min?.toString() ?? "",
    budget: profile.budget ?? "",
    kitchen: profile.kitchen ?? "",
  }
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function ProfileInfo({ profile }: ProfileInfoProps) {
  const displayName = profile.full_name ?? profile.name ?? "Athlete"
  const goal = profile.primary_goal ?? "—"
  const weightUnit = profile.units === "imperial" ? "lbs" : "kg"
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formState, setFormState] = useState<ProfileFormState>(() => buildFormState(profile))

  const isDirty = useMemo(() => {
    const baseline = buildFormState(profile)
    return Object.entries(formState).some(([key, value]) => value !== baseline[key as keyof ProfileFormState])
  }, [formState, profile])

  useEffect(() => {
    if (open) {
      setFormState(buildFormState(profile))
      setError(null)
    }
  }, [open, profile])

  const handleChange = (field: keyof ProfileFormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleUnitsChange = (value: Units) => {
    setFormState((prev) => ({ ...prev, units: value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    const payload = {
      full_name: formState.full_name.trim() || null,
      avatar_url: formState.avatar_url.trim() || null,
      height_cm: parseOptionalNumber(formState.height_cm),
      weight_kg: parseOptionalNumber(formState.weight_kg),
      units: formState.units,
      primary_goal: formState.primary_goal.trim() || null,
      experience_level: formState.experience_level.trim() || null,
      event: formState.event.trim() || null,
      sports: formState.sports
        .split(",")
        .map((sport) => sport.trim())
        .filter(Boolean),
      workout_time: formState.workout_time.trim() || null,
      diet: formState.diet.trim() || null,
      meals_per_day: parseOptionalNumber(formState.meals_per_day),
      cooking_time_min: parseOptionalNumber(formState.cooking_time_min),
      budget: formState.budget.trim() || null,
      kitchen: formState.kitchen.trim() || null,
    }

    try {
      const response = await fetch("/api/v1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        const message = errorBody?.error ?? "Failed to update profile"
        setError(message)
        toast({ title: "Profile update failed", description: message, variant: "destructive" })
        return
      }

      await queryClient.invalidateQueries({ queryKey: ["db", "profile", profile.id] })
      toast({ title: "Profile updated", description: "Your profile changes have been saved." })
      setOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile"
      setError(message)
      toast({ title: "Profile update failed", description: message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar_url || "/placeholder.svg"} />
            <AvatarFallback>
              {displayName
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold text-foreground">{displayName}</h2>
            <p className="text-muted-foreground">{profile.experience_level ?? ""}</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <Edit2 className="h-4 w-4" />
              Edit Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit profile</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" value={formState.full_name} onChange={handleChange("full_name")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avatar_url">Avatar URL</Label>
                  <Input id="avatar_url" value={formState.avatar_url} onChange={handleChange("avatar_url")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height_cm">Height (cm)</Label>
                  <Input id="height_cm" value={formState.height_cm} onChange={handleChange("height_cm")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight_kg">Weight (kg)</Label>
                  <Input id="weight_kg" value={formState.weight_kg} onChange={handleChange("weight_kg")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="units">Units</Label>
                  <Select value={formState.units} onValueChange={handleUnitsChange}>
                    <SelectTrigger id="units">
                      <SelectValue placeholder="Select units" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="metric">Metric</SelectItem>
                      <SelectItem value="imperial">Imperial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primary_goal">Primary goal</Label>
                  <Input id="primary_goal" value={formState.primary_goal} onChange={handleChange("primary_goal")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience_level">Experience level</Label>
                  <Input
                    id="experience_level"
                    value={formState.experience_level}
                    onChange={handleChange("experience_level")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event">Event</Label>
                  <Input id="event" value={formState.event} onChange={handleChange("event")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sports">Sports (comma-separated)</Label>
                  <Input id="sports" value={formState.sports} onChange={handleChange("sports")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workout_time">Workout time</Label>
                  <Input id="workout_time" value={formState.workout_time} onChange={handleChange("workout_time")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diet">Diet</Label>
                  <Input id="diet" value={formState.diet} onChange={handleChange("diet")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meals_per_day">Meals per day</Label>
                  <Input id="meals_per_day" value={formState.meals_per_day} onChange={handleChange("meals_per_day")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cooking_time_min">Cooking time (min)</Label>
                  <Input
                    id="cooking_time_min"
                    value={formState.cooking_time_min}
                    onChange={handleChange("cooking_time_min")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget">Budget</Label>
                  <Input id="budget" value={formState.budget} onChange={handleChange("budget")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kitchen">Kitchen</Label>
                  <Input id="kitchen" value={formState.kitchen} onChange={handleChange("kitchen")} />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving || !isDirty}>
                  {isSaving && <Spinner className="mr-2" />}
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-4 bg-muted rounded-xl">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm font-medium text-foreground">{profile.email ?? ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-muted rounded-xl">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Weight</p>
            <p className="text-sm font-medium text-foreground">
              {profile.weight_kg ?? "—"} {weightUnit}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-muted rounded-xl">
          <Target className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Goal</p>
            <p className="text-sm font-medium text-foreground">{goal}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

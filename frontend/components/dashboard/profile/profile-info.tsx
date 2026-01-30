"use client"

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { Mail, Scale, Target, Edit2 } from "lucide-react"
import { z } from "zod"
import { useQueryClient } from "@tanstack/react-query"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { CenteredModal } from "@/components/ui/centered-modal"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
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
  allergies_restrictions: string
  preferred_cuisine: string
  cooking_time_preference: string
  budget_preference: string
  daily_schedule: string
}

const DEFAULT_UNITS: Units = "metric"
const primaryGoalOptions = [
  { value: "performance", label: "Performance" },
  { value: "fat_loss", label: "Fat Loss" },
  { value: "muscle_gain", label: "Muscle Gain" },
  { value: "maintenance", label: "Maintenance" },
  { value: "health", label: "General Health" },
]
const experienceOptions = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
]
const workoutTimeOptions = [
  { value: "morning", label: "Morning" },
  { value: "midday", label: "Midday" },
  { value: "evening", label: "Evening" },
]
const dietOptions = [
  { value: "omnivore", label: "Omnivore" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "other", label: "Other" },
]
const budgetOptions = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "premium", label: "Premium" },
]
const cookingTimeOptions = [
  { value: "quick", label: "Quick (15-20 min)" },
  { value: "normal", label: "Normal (30-45 min)" },
  { value: "batch", label: "Batch cooking" },
]
const sportsOptions = [
  { value: "swim", label: "Swim" },
  { value: "bike", label: "Bike" },
  { value: "run", label: "Run" },
  { value: "gym", label: "Gym" },
]

const profileSchema = z.object({
  full_name: z.string().optional(),
  avatar_url: z.string().url().or(z.literal("")).optional(),
  height_cm: z.string().optional(),
  weight_kg: z.string().optional(),
  units: z.enum(["metric", "imperial"]),
  primary_goal: z.string().optional(),
  experience_level: z.string().optional(),
  event: z.string().optional(),
  sports: z.string().optional(),
  workout_time: z.string().optional(),
  diet: z.string().optional(),
  meals_per_day: z.string().optional(),
  allergies_restrictions: z.string().optional(),
  preferred_cuisine: z.string().optional(),
  cooking_time_preference: z.string().optional(),
  budget_preference: z.string().optional(),
  daily_schedule: z.string().optional(),
})

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
    allergies_restrictions: Array.isArray(profile.allergies_restrictions)
      ? profile.allergies_restrictions.join(", ")
      : profile.allergies_restrictions ?? "",
    preferred_cuisine: profile.preferred_cuisine ?? "",
    cooking_time_preference: profile.cooking_time_preference ?? "",
    budget_preference: profile.budget_preference ?? "",
    daily_schedule: profile.daily_schedule ?? "",
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
  const [activeTab, setActiveTab] = useState("basics")

  const isDirty = useMemo(() => {
    const baseline = buildFormState(profile)
    return Object.entries(formState).some(([key, value]) => value !== baseline[key as keyof ProfileFormState])
  }, [formState, profile])

  useEffect(() => {
    if (open) {
      setFormState(buildFormState(profile))
      setError(null)
      setActiveTab("basics")
    }
  }, [open, profile])

  const handleChange =
    (field: keyof ProfileFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormState((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const handleSelectChange = (field: keyof ProfileFormState) => (value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const toggleSport = (sport: string) => {
    const currentSports = formState.sports
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
    const nextSports = currentSports.includes(sport)
      ? currentSports.filter((item) => item !== sport)
      : [...currentSports, sport]
    setFormState((prev) => ({ ...prev, sports: nextSports.join(", ") }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    const parsed = profileSchema.safeParse(formState)
    if (!parsed.success) {
      setError("Please review the highlighted fields before saving.")
      setIsSaving(false)
      return
    }

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
      allergies_restrictions: formState.allergies_restrictions
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      preferred_cuisine: formState.preferred_cuisine.trim() || null,
      cooking_time_preference: formState.cooking_time_preference.trim() || null,
      budget_preference: formState.budget_preference.trim() || null,
      daily_schedule: formState.daily_schedule.trim() || null,
    }

    try {
      const response = await fetch("/api/profile", {
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
        <Button variant="outline" size="sm" className="gap-2 bg-transparent" onClick={() => setOpen(true)}>
          <Edit2 className="h-4 w-4" />
          Edit Profile
        </Button>
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

      <CenteredModal open={open} onOpenChange={setOpen} title="Edit profile">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="basics">Basics</TabsTrigger>
              <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
            </TabsList>

            <TabsContent value="basics" className="mt-4">
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
                  <Label htmlFor="primary_goal">Primary goal</Label>
                  <Select value={formState.primary_goal} onValueChange={handleSelectChange("primary_goal")}>
                    <SelectTrigger id="primary_goal">
                      <SelectValue placeholder="Select your primary goal" />
                    </SelectTrigger>
                    <SelectContent>
                      {primaryGoalOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience_level">Experience level</Label>
                  <Select value={formState.experience_level} onValueChange={handleSelectChange("experience_level")}>
                    <SelectTrigger id="experience_level">
                      <SelectValue placeholder="Select your experience level" />
                    </SelectTrigger>
                    <SelectContent>
                      {experienceOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event">Event</Label>
                  <Input id="event" value={formState.event} onChange={handleChange("event")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sports">Sports</Label>
                  <div className="flex flex-wrap gap-2">
                    {sportsOptions.map((sport) => {
                      const isActive = formState.sports.split(",").map((item) => item.trim()).includes(sport.value)
                      return (
                        <button
                          key={sport.value}
                          type="button"
                          onClick={() => toggleSport(sport.value)}
                          className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/70"
                          }`}
                        >
                          {sport.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workout_time">Workout time</Label>
                  <Select value={formState.workout_time} onValueChange={handleSelectChange("workout_time")}>
                    <SelectTrigger id="workout_time">
                      <SelectValue placeholder="Select workout time" />
                    </SelectTrigger>
                    <SelectContent>
                      {workoutTimeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="nutrition" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="diet">Diet</Label>
                  <Select value={formState.diet} onValueChange={handleSelectChange("diet")}>
                    <SelectTrigger id="diet">
                      <SelectValue placeholder="Select diet type" />
                    </SelectTrigger>
                    <SelectContent>
                      {dietOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meals_per_day">Meals per day</Label>
                  <Select value={formState.meals_per_day} onValueChange={handleSelectChange("meals_per_day")}>
                    <SelectTrigger id="meals_per_day">
                      <SelectValue placeholder="Select meals per day" />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6].map((count) => (
                        <SelectItem key={count} value={String(count)}>
                          {count} meals
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allergies_restrictions">Allergies & restrictions</Label>
                  <Textarea
                    id="allergies_restrictions"
                    value={formState.allergies_restrictions}
                    onChange={handleChange("allergies_restrictions")}
                    placeholder="e.g. dairy-free, peanuts"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferred_cuisine">Preferred cuisine</Label>
                  <Input
                    id="preferred_cuisine"
                    value={formState.preferred_cuisine}
                    onChange={handleChange("preferred_cuisine")}
                    placeholder="e.g. Mediterranean"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preferences" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cooking_time_preference">Cooking time preference</Label>
                  <Select
                    value={formState.cooking_time_preference}
                    onValueChange={handleSelectChange("cooking_time_preference")}
                  >
                    <SelectTrigger id="cooking_time_preference">
                      <SelectValue placeholder="Select preference" />
                    </SelectTrigger>
                    <SelectContent>
                      {cookingTimeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget_preference">Budget preference</Label>
                  <Select value={formState.budget_preference} onValueChange={handleSelectChange("budget_preference")}>
                    <SelectTrigger id="budget_preference">
                      <SelectValue placeholder="Select budget" />
                    </SelectTrigger>
                    <SelectContent>
                      {budgetOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="daily_schedule">Daily schedule (optional)</Label>
                  <Textarea
                    id="daily_schedule"
                    value={formState.daily_schedule}
                    onChange={handleChange("daily_schedule")}
                    placeholder="Breakfast 7-8am, Lunch 12-1pm, Dinner 7-8pm"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !isDirty}>
              {isSaving && <Spinner className="mr-2" />}
              Save changes
            </Button>
          </div>
        </form>
      </CenteredModal>
    </div>
  )
}

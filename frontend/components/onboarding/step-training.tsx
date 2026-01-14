"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from "react-hook-form"
import type { OnboardingFormData } from "@/app/onboarding/page"

interface StepTrainingProps {
  register: UseFormRegister<OnboardingFormData>
  setValue: UseFormSetValue<OnboardingFormData>
  watch: UseFormWatch<OnboardingFormData>
  errors: FieldErrors<OnboardingFormData>
}

const sportsOptions = [
  { id: "swim", label: "Swim" },
  { id: "bike", label: "Bike" },
  { id: "run", label: "Run" },
  { id: "gym", label: "Gym" },
]

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export function StepTraining({ register, setValue, watch, errors }: StepTrainingProps) {
  const sports = watch("sports") || []
  const daysOff = watch("days_off_preference") || []

  const toggleSport = (sport: string) => {
    if (sports.includes(sport)) {
      setValue(
        "sports",
        sports.filter((s) => s !== sport),
      )
    } else {
      setValue("sports", [...sports, sport])
    }
  }

  const toggleDayOff = (day: string) => {
    if (daysOff.includes(day)) {
      setValue(
        "days_off_preference",
        daysOff.filter((d) => d !== day),
      )
    } else {
      setValue("days_off_preference", [...daysOff, day])
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-gray-300 text-sm">
          Sports <span className="text-red-400">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {sportsOptions.map((sport) => (
            <button
              key={sport.id}
              type="button"
              onClick={() => toggleSport(sport.id)}
              className={`p-4 rounded-lg border transition-all text-left ${
                sports.includes(sport.id)
                  ? "bg-green-500/20 border-green-500 text-white"
                  : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
              }`}
            >
              {sport.label}
            </button>
          ))}
        </div>
        {errors.sports && <p className="text-red-400 text-xs">{errors.sports.message}</p>}
      </div>

      {sports.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {sports.includes("swim") && (
            <div className="space-y-2">
              <Label className="text-gray-400 text-xs">Weekly Swim Sessions</Label>
              <Input
                type="number"
                {...register("weekly_sessions_swim", { valueAsNumber: true })}
                placeholder="3"
                className="bg-[#0a1628] border-white/20 text-white"
              />
            </div>
          )}
          {sports.includes("bike") && (
            <div className="space-y-2">
              <Label className="text-gray-400 text-xs">Weekly Bike Sessions</Label>
              <Input
                type="number"
                {...register("weekly_sessions_bike", { valueAsNumber: true })}
                placeholder="3"
                className="bg-[#0a1628] border-white/20 text-white"
              />
            </div>
          )}
          {sports.includes("run") && (
            <div className="space-y-2">
              <Label className="text-gray-400 text-xs">Weekly Run Sessions</Label>
              <Input
                type="number"
                {...register("weekly_sessions_run", { valueAsNumber: true })}
                placeholder="3"
                className="bg-[#0a1628] border-white/20 text-white"
              />
            </div>
          )}
          {sports.includes("gym") && (
            <div className="space-y-2">
              <Label className="text-gray-400 text-xs">Weekly Gym Sessions</Label>
              <Input
                type="number"
                {...register("weekly_sessions_gym", { valueAsNumber: true })}
                placeholder="2"
                className="bg-[#0a1628] border-white/20 text-white"
              />
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-gray-300 text-sm">Intensity Preference</Label>
        <Select onValueChange={(value) => setValue("intensity_preference", value)}>
          <SelectTrigger className="bg-[#0a1628] border-white/20 text-white">
            <SelectValue placeholder="Select preference" />
          </SelectTrigger>
          <SelectContent className="bg-[#111d32] border-white/20">
            <SelectItem value="polarized">Polarized</SelectItem>
            <SelectItem value="sweetspot">Sweet Spot</SelectItem>
            <SelectItem value="mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-gray-300 text-sm">Long Session Day</Label>
          <Select onValueChange={(value) => setValue("long_session_day", value)}>
            <SelectTrigger className="bg-[#0a1628] border-white/20 text-white">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent className="bg-[#111d32] border-white/20">
              {weekdays.map((day) => (
                <SelectItem key={day} value={day.toLowerCase()}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300 text-sm">
            Typical Workout Time <span className="text-red-400">*</span>
          </Label>
          <Select onValueChange={(value) => setValue("typical_workout_time", value)}>
            <SelectTrigger className="bg-[#0a1628] border-white/20 text-white">
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent className="bg-[#111d32] border-white/20">
              <SelectItem value="morning">Morning</SelectItem>
              <SelectItem value="midday">Midday</SelectItem>
              <SelectItem value="evening">Evening</SelectItem>
            </SelectContent>
          </Select>
          {errors.typical_workout_time && <p className="text-red-400 text-xs">{errors.typical_workout_time.message}</p>}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-gray-300 text-sm">Preferred Rest Days</Label>
        <div className="flex flex-wrap gap-2">
          {weekdays.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDayOff(day.toLowerCase())}
              className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                daysOff.includes(day.toLowerCase())
                  ? "bg-green-500 text-white"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

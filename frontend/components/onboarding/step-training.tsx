"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CardRadioGroup } from "@/components/onboarding/card-radio-group"
import { FieldError } from "@/components/onboarding/field-error"
import { SelectableChips } from "@/components/onboarding/selectable-chips"
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
  const intensityPreference = watch("intensity_preference")
  const longSessionDay = watch("long_session_day")
  const typicalWorkoutTime = watch("typical_workout_time")

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-gray-300 text-sm">
          Sports <span className="text-red-400">*</span>
        </Label>
        <CardRadioGroup
          options={sportsOptions.map((sport) => ({ value: sport.id, label: sport.label }))}
          value={sports}
          multiple
          onChange={(value) => setValue("sports", value as string[], { shouldValidate: true })}
        />
        <FieldError message={errors.sports?.message} />
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
        <Select
          value={intensityPreference ?? ""}
          onValueChange={(value) => setValue("intensity_preference", value, { shouldValidate: true })}
        >
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
          <Select
            value={longSessionDay ?? ""}
            onValueChange={(value) => setValue("long_session_day", value, { shouldValidate: true })}
          >
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
          <Select
            value={typicalWorkoutTime ?? ""}
            onValueChange={(value) => setValue("typical_workout_time", value, { shouldValidate: true })}
          >
            <SelectTrigger className="bg-[#0a1628] border-white/20 text-white">
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent className="bg-[#111d32] border-white/20">
              <SelectItem value="morning">Morning</SelectItem>
              <SelectItem value="midday">Midday</SelectItem>
              <SelectItem value="evening">Evening</SelectItem>
            </SelectContent>
          </Select>
          <FieldError message={errors.typical_workout_time?.message} />
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-gray-300 text-sm">Preferred Rest Days</Label>
        <SelectableChips
          options={weekdays.map((day) => ({ value: day.toLowerCase(), label: day.slice(0, 3) }))}
          value={daysOff}
          multiple
          onChange={(value) => setValue("days_off_preference", value as string[], { shouldValidate: true })}
        />
      </div>
    </div>
  )
}

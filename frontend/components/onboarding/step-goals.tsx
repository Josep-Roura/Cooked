"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { UseFormRegister, UseFormSetValue, FieldErrors } from "react-hook-form"
import type { OnboardingFormData } from "@/app/onboarding/page"

interface StepGoalsProps {
  register: UseFormRegister<OnboardingFormData>
  setValue: UseFormSetValue<OnboardingFormData>
  errors: FieldErrors<OnboardingFormData>
}

export function StepGoals({ register, setValue, errors }: StepGoalsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-gray-300 text-sm">
          Primary Goal <span className="text-red-400">*</span>
        </Label>
        <Select onValueChange={(value) => setValue("primary_goal", value)}>
          <SelectTrigger className="bg-[#0a1628] border-white/20 text-white">
            <SelectValue placeholder="Select your primary goal" />
          </SelectTrigger>
          <SelectContent className="bg-[#111d32] border-white/20">
            <SelectItem value="performance">Performance</SelectItem>
            <SelectItem value="fat_loss">Fat Loss</SelectItem>
            <SelectItem value="muscle_gain">Muscle Gain</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="health">General Health</SelectItem>
          </SelectContent>
        </Select>
        {errors.primary_goal && <p className="text-red-400 text-xs">{errors.primary_goal.message}</p>}
      </div>

      <div className="space-y-2">
        <Label className="text-gray-300 text-sm">
          Experience Level <span className="text-red-400">*</span>
        </Label>
        <Select onValueChange={(value) => setValue("experience_level", value)}>
          <SelectTrigger className="bg-[#0a1628] border-white/20 text-white">
            <SelectValue placeholder="Select your experience level" />
          </SelectTrigger>
          <SelectContent className="bg-[#111d32] border-white/20">
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
        {errors.experience_level && <p className="text-red-400 text-xs">{errors.experience_level.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="target_weight_kg" className="text-gray-300 text-sm">
          Target Weight (kg)
        </Label>
        <Input
          id="target_weight_kg"
          type="number"
          {...register("target_weight_kg", { valueAsNumber: true })}
          placeholder="65"
          className="bg-[#0a1628] border-white/20 text-white placeholder:text-gray-500"
        />
      </div>

      <div className="p-4 bg-white/5 rounded-lg space-y-4">
        <p className="text-gray-300 text-sm font-medium">Upcoming Event (optional)</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="event_name" className="text-gray-400 text-xs">
              Event Name
            </Label>
            <Input
              id="event_name"
              {...register("event_name")}
              placeholder="Ironman 70.3"
              className="bg-[#0a1628] border-white/20 text-white placeholder:text-gray-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_date" className="text-gray-400 text-xs">
              Event Date
            </Label>
            <Input
              id="event_date"
              type="date"
              {...register("event_date")}
              className="bg-[#0a1628] border-white/20 text-white [&::-webkit-calendar-picker-indicator]:invert"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="weekly_training_hours_target" className="text-gray-300 text-sm">
          Weekly Training Hours Target
        </Label>
        <Input
          id="weekly_training_hours_target"
          type="number"
          {...register("weekly_training_hours_target", { valueAsNumber: true })}
          placeholder="10"
          className="bg-[#0a1628] border-white/20 text-white placeholder:text-gray-500"
        />
      </div>
    </div>
  )
}

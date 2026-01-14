"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { X } from "lucide-react"
import { FieldError } from "@/components/onboarding/field-error"
import { SelectableChips } from "@/components/onboarding/selectable-chips"
import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from "react-hook-form"
import type { OnboardingFormData } from "@/app/onboarding/page"

interface StepNutritionProps {
  register: UseFormRegister<OnboardingFormData>
  setValue: UseFormSetValue<OnboardingFormData>
  watch: UseFormWatch<OnboardingFormData>
  errors: FieldErrors<OnboardingFormData>
}

const commonAllergies = ["gluten", "lactose", "nuts", "shellfish", "eggs", "soy"]

export function StepNutrition({ register, setValue, watch, errors }: StepNutritionProps) {
  const allergies = watch("allergies") || []
  const hydrationFocus = watch("hydration_focus")
  const [customAllergy, setCustomAllergy] = useState("")
  const dietType = watch("diet_type")
  const mealsPerDay = watch("meals_per_day")
  const caffeine = watch("caffeine")

  const toggleAllergy = (allergy: string) => {
    if (allergies.includes(allergy)) {
      setValue(
        "allergies",
        allergies.filter((a) => a !== allergy),
        { shouldValidate: true },
      )
    } else {
      setValue("allergies", [...allergies, allergy], { shouldValidate: true })
    }
  }

  const addCustomAllergy = () => {
    if (customAllergy.trim() && !allergies.includes(customAllergy.toLowerCase())) {
      setValue("allergies", [...allergies, customAllergy.toLowerCase()], { shouldValidate: true })
      setCustomAllergy("")
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-gray-300 text-sm">
          Diet Type <span className="text-red-400">*</span>
        </Label>
        <Select value={dietType ?? ""} onValueChange={(value) => setValue("diet_type", value, { shouldValidate: true })}>
          <SelectTrigger className="bg-[#0a1628] border-white/20 text-white">
            <SelectValue placeholder="Select diet type" />
          </SelectTrigger>
          <SelectContent className="bg-[#111d32] border-white/20">
            <SelectItem value="omnivore">Omnivore</SelectItem>
            <SelectItem value="vegetarian">Vegetarian</SelectItem>
            <SelectItem value="vegan">Vegan</SelectItem>
            <SelectItem value="pescatarian">Pescatarian</SelectItem>
          </SelectContent>
        </Select>
        <FieldError message={errors.diet_type?.message} />
      </div>

      <div className="space-y-3">
        <Label className="text-gray-300 text-sm">Allergies & Intolerances</Label>
        <SelectableChips
          options={commonAllergies.map((allergy) => ({ value: allergy, label: allergy }))}
          value={allergies}
          multiple
          onChange={(value) => setValue("allergies", value as string[], { shouldValidate: true })}
          chipClassName="capitalize"
          selectedClassName="bg-red-500/20 text-red-400 border border-red-500/50"
          unselectedClassName="border border-transparent"
        />
        {allergies.filter((a) => !commonAllergies.includes(a)).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {allergies
              .filter((a) => !commonAllergies.includes(a))
              .map((allergy) => (
                <span
                  key={allergy}
                  className="px-3 py-1.5 rounded-full text-sm bg-red-500/20 text-red-400 border border-red-500/50 flex items-center gap-1"
                >
                  {allergy}
                  <button type="button" onClick={() => toggleAllergy(allergy)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={customAllergy}
            onChange={(e) => setCustomAllergy(e.target.value)}
            placeholder="Add custom allergy"
            className="bg-[#0a1628] border-white/20 text-white placeholder:text-gray-500"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomAllergy())}
          />
          <button
            type="button"
            onClick={addCustomAllergy}
            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dislikes" className="text-gray-300 text-sm">
          Food Dislikes
        </Label>
        <Textarea
          id="dislikes"
          {...register("dislikes")}
          placeholder="List any foods you dislike or want to avoid..."
          className="bg-[#0a1628] border-white/20 text-white placeholder:text-gray-500 min-h-[80px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-gray-300 text-sm">
            Meals Per Day <span className="text-red-400">*</span>
          </Label>
          <Select
            value={mealsPerDay ? mealsPerDay.toString() : ""}
            onValueChange={(value) => setValue("meals_per_day", Number.parseInt(value, 10), { shouldValidate: true })}
          >
            <SelectTrigger className="bg-[#0a1628] border-white/20 text-white">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="bg-[#111d32] border-white/20">
              {[2, 3, 4, 5, 6].map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num} meals
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors.meals_per_day?.message} />
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300 text-sm">
            Caffeine Intake <span className="text-red-400">*</span>
          </Label>
          <Select value={caffeine ?? ""} onValueChange={(value) => setValue("caffeine", value, { shouldValidate: true })}>
            <SelectTrigger className="bg-[#0a1628] border-white/20 text-white">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="bg-[#111d32] border-white/20">
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <FieldError message={errors.caffeine?.message} />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
        <div>
          <p className="text-gray-300 text-sm">Hydration Focus</p>
          <p className="text-gray-500 text-xs">Get reminders and tips for hydration</p>
        </div>
        <Switch
          checked={hydrationFocus}
          onCheckedChange={(checked) => setValue("hydration_focus", checked, { shouldValidate: true })}
        />
      </div>
    </div>
  )
}

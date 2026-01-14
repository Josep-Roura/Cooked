"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { FieldError } from "@/components/onboarding/field-error"
import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from "react-hook-form"
import type { OnboardingFormData } from "@/app/onboarding/page"

interface StepPersonalProps {
  register: UseFormRegister<OnboardingFormData>
  setValue: UseFormSetValue<OnboardingFormData>
  watch: UseFormWatch<OnboardingFormData>
  errors: FieldErrors<OnboardingFormData>
  userEmail?: string
}

export function StepPersonal({ register, setValue, watch, errors, userEmail }: StepPersonalProps) {
  const units = watch("units")
  const gender = watch("gender")
  const birthdate = watch("birthdate")
  const formattedBirthdate = formatDateValue(birthdate)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="full_name" className="text-gray-300 text-sm">
          Full Name <span className="text-red-400">*</span>
        </Label>
        <Input
          id="full_name"
          {...register("full_name")}
          placeholder="John Doe"
          className="bg-[#0a1628] border-white/20 text-white placeholder:text-gray-500 focus:border-green-500"
        />
        <FieldError message={errors.full_name?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-gray-300 text-sm">
          Email
        </Label>
        <Input
          id="email"
          value={userEmail || ""}
          disabled
          className="bg-[#0a1628]/50 border-white/10 text-gray-400 cursor-not-allowed"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="gender" className="text-gray-300 text-sm">
            Gender
          </Label>
          <Select value={gender ?? ""} onValueChange={(value) => setValue("gender", value, { shouldValidate: true })}>
            <SelectTrigger className="bg-[#0a1628] border-white/20 text-white">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="bg-[#111d32] border-white/20">
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="birthdate" className="text-gray-300 text-sm">
            Birthdate
          </Label>
          <Input
            id="birthdate"
            type="date"
            name="birthdate"
            value={formattedBirthdate}
            onChange={(event) =>
              setValue(
                "birthdate",
                event.target.value ? new Date(event.target.value).toISOString() : "",
                { shouldValidate: true },
              )
            }
            className="bg-[#0a1628] border-white/20 text-white [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
        <span className="text-gray-300 text-sm">Units</span>
        <div className="flex items-center gap-3">
          <span className={`text-sm ${units === "metric" ? "text-green-500" : "text-gray-400"}`}>Metric</span>
          <Switch
            checked={units === "imperial"}
            onCheckedChange={(checked) => setValue("units", checked ? "imperial" : "metric", { shouldValidate: true })}
          />
          <span className={`text-sm ${units === "imperial" ? "text-green-500" : "text-gray-400"}`}>Imperial</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="height_cm" className="text-gray-300 text-sm">
            Height {units === "metric" ? "(cm)" : "(in)"}
          </Label>
          <Input
            id="height_cm"
            type="number"
            {...register("height_cm", { valueAsNumber: true })}
            placeholder={units === "metric" ? "175" : "69"}
            className="bg-[#0a1628] border-white/20 text-white placeholder:text-gray-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="weight_kg" className="text-gray-300 text-sm">
            Weight {units === "metric" ? "(kg)" : "(lb)"} <span className="text-red-400">*</span>
          </Label>
          <Input
            id="weight_kg"
            type="number"
            {...register("weight_kg", { valueAsNumber: true })}
            placeholder={units === "metric" ? "70" : "154"}
            className="bg-[#0a1628] border-white/20 text-white placeholder:text-gray-500"
          />
          <FieldError message={errors.weight_kg?.message} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="country" className="text-gray-300 text-sm">
            Country
          </Label>
          <Input
            id="country"
            {...register("country")}
            placeholder="United States"
            className="bg-[#0a1628] border-white/20 text-white placeholder:text-gray-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone" className="text-gray-300 text-sm">
            Timezone
          </Label>
          <Input
            id="timezone"
            {...register("timezone")}
            placeholder="America/New_York"
            className="bg-[#0a1628] border-white/20 text-white placeholder:text-gray-500"
          />
        </div>
      </div>
    </div>
  )
}

function formatDateValue(value?: string) {
  if (!value) {
    return ""
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ""
  }
  return parsed.toISOString().split("T")[0]
}

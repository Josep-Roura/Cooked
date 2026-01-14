"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldError } from "@/components/onboarding/field-error"
import type { UseFormSetValue, UseFormWatch, FieldErrors } from "react-hook-form"
import type { OnboardingFormData } from "@/app/onboarding/page"

interface StepConstraintsProps {
  setValue: UseFormSetValue<OnboardingFormData>
  watch: UseFormWatch<OnboardingFormData>
  errors: FieldErrors<OnboardingFormData>
}

export function StepConstraints({ setValue, watch, errors }: StepConstraintsProps) {
  const connectTrainingpeaks = watch("connect_trainingpeaks")
  const acceptTerms = watch("accept_terms")
  const dataProcessingConsent = watch("data_processing_consent")
  const cookingTime = watch("cooking_time_per_day")
  const budgetLevel = watch("budget_level")
  const kitchenAccess = watch("kitchen_access")
  const travelFrequency = watch("travel_frequency")

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-white font-medium">Cooking & Budget</h3>

        <div className="space-y-2">
          <Label className="text-gray-300 text-sm">
            Cooking Time Per Day <span className="text-red-400">*</span>
          </Label>
          <Select
            value={cookingTime ?? ""}
            onValueChange={(value) => setValue("cooking_time_per_day", value, { shouldValidate: true })}
          >
            <SelectTrigger className="bg-[#0a1628] border-white/20 text-white">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="bg-[#111d32] border-white/20">
              <SelectItem value="10m">10 minutes</SelectItem>
              <SelectItem value="20m">20 minutes</SelectItem>
              <SelectItem value="30m">30 minutes</SelectItem>
              <SelectItem value="60m">60+ minutes</SelectItem>
            </SelectContent>
          </Select>
          <FieldError message={errors.cooking_time_per_day?.message} />
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300 text-sm">
            Budget Level <span className="text-red-400">*</span>
          </Label>
          <Select
            value={budgetLevel ?? ""}
            onValueChange={(value) => setValue("budget_level", value, { shouldValidate: true })}
          >
            <SelectTrigger className="bg-[#0a1628] border-white/20 text-white">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="bg-[#111d32] border-white/20">
              <SelectItem value="low">Low - Budget conscious</SelectItem>
              <SelectItem value="medium">Medium - Balanced</SelectItem>
              <SelectItem value="high">High - Premium ingredients</SelectItem>
            </SelectContent>
          </Select>
          <FieldError message={errors.budget_level?.message} />
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300 text-sm">
            Kitchen Access <span className="text-red-400">*</span>
          </Label>
          <Select
            value={kitchenAccess ?? ""}
            onValueChange={(value) => setValue("kitchen_access", value, { shouldValidate: true })}
          >
            <SelectTrigger className="bg-[#0a1628] border-white/20 text-white">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="bg-[#111d32] border-white/20">
              <SelectItem value="full_kitchen">Full Kitchen</SelectItem>
              <SelectItem value="microwave_only">Microwave Only</SelectItem>
              <SelectItem value="no_kitchen">No Kitchen</SelectItem>
            </SelectContent>
          </Select>
          <FieldError message={errors.kitchen_access?.message} />
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300 text-sm">
            Travel Frequency <span className="text-red-400">*</span>
          </Label>
          <Select
            value={travelFrequency ?? ""}
            onValueChange={(value) => setValue("travel_frequency", value, { shouldValidate: true })}
          >
            <SelectTrigger className="bg-[#0a1628] border-white/20 text-white">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="bg-[#111d32] border-white/20">
              <SelectItem value="never">Never</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
          <FieldError message={errors.travel_frequency?.message} />
        </div>
      </div>

      <div className="border-t border-white/10 pt-6 space-y-4">
        <h3 className="text-white font-medium">Integrations</h3>

        <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
          <div>
            <p className="text-gray-300 text-sm">Connect TrainingPeaks</p>
            <p className="text-gray-500 text-xs">Sync your workouts automatically</p>
          </div>
          <Switch
            checked={connectTrainingpeaks}
            onCheckedChange={(checked) => setValue("connect_trainingpeaks", checked, { shouldValidate: true })}
          />
        </div>
      </div>

      <div className="border-t border-white/10 pt-6 space-y-4">
        <h3 className="text-white font-medium">Legal</h3>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="accept_terms"
              checked={acceptTerms}
              onCheckedChange={(checked) => setValue("accept_terms", Boolean(checked), { shouldValidate: true })}
              className="mt-1 border-white/20 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
            />
            <label htmlFor="accept_terms" className="text-gray-300 text-sm cursor-pointer">
              I accept the{" "}
              <a href="/terms" className="text-green-500 hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-green-500 hover:underline">
                Privacy Policy
              </a>{" "}
              <span className="text-red-400">*</span>
            </label>
          </div>
          <FieldError message={errors.accept_terms?.message} />

          <div className="flex items-start gap-3">
            <Checkbox
              id="data_processing_consent"
              checked={dataProcessingConsent}
              onCheckedChange={(checked) => setValue("data_processing_consent", Boolean(checked), { shouldValidate: true })}
              className="mt-1 border-white/20 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
            />
            <label htmlFor="data_processing_consent" className="text-gray-300 text-sm cursor-pointer">
              I consent to the processing of my health and fitness data to provide personalized nutrition
              recommendations <span className="text-red-400">*</span>
            </label>
          </div>
          <FieldError message={errors.data_processing_consent?.message} />
        </div>
      </div>
    </div>
  )
}

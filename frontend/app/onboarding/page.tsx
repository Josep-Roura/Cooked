"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ProgressIndicator } from "@/components/onboarding/progress-indicator"
import { StepPersonal } from "@/components/onboarding/step-personal"
import { StepGoals } from "@/components/onboarding/step-goals"
import { StepTraining } from "@/components/onboarding/step-training"
import { StepNutrition } from "@/components/onboarding/step-nutrition"
import { StepConstraints } from "@/components/onboarding/step-constraints"
import { ReviewSummary } from "@/components/onboarding/review-summary"
import { useSession } from "@/hooks/use-session"
import { useOnboardingProfileSave, useProfile } from "@/lib/db/hooks"
import type { OnboardingProfileInput } from "@/lib/db/types"
import { Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react"

const onboardingSchema = z.object({
  // Personal
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email().optional(),
  gender: z.string().optional(),
  birthdate: z.string().optional(),
  height_cm: z.number().optional(),
  weight_kg: z.number().min(20, "Please enter a valid weight"),
  country: z.string().optional(),
  timezone: z.string().optional(),
  units: z.enum(["metric", "imperial"]),

  // Goals
  primary_goal: z.string().min(1, "Please select a primary goal"),
  target_weight_kg: z.number().optional(),
  event_name: z.string().optional(),
  event_date: z.string().optional(),
  weekly_training_hours_target: z.number().optional(),
  experience_level: z.string().min(1, "Please select your experience level"),

  // Training
  sports: z.array(z.string()).min(1, "Please select at least one sport"),
  weekly_sessions_swim: z.number().optional(),
  weekly_sessions_bike: z.number().optional(),
  weekly_sessions_run: z.number().optional(),
  weekly_sessions_gym: z.number().optional(),
  intensity_preference: z.string().optional(),
  long_session_day: z.string().optional(),
  typical_workout_time: z.string().min(1, "Please select your typical workout time"),
  days_off_preference: z.array(z.string()).optional(),

  // Nutrition
  diet_type: z.string().min(1, "Please select your diet type"),
  allergies: z.array(z.string()).optional(),
  dislikes: z.string().optional(),
  meals_per_day: z.number().min(2).max(6),
  caffeine: z.string().min(1, "Please select your caffeine intake"),
  hydration_focus: z.boolean(),

  // Constraints
  cooking_time_per_day: z.string().min(1, "Please select cooking time"),
  budget_level: z.string().min(1, "Please select budget level"),
  kitchen_access: z.string().min(1, "Please select kitchen access"),
  travel_frequency: z.string().min(1, "Please select travel frequency"),

  // App usage
  connect_trainingpeaks: z.boolean(),
  accept_terms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
  data_processing_consent: z.literal(true, { errorMap: () => ({ message: "You must consent to data processing" }) }),
})

export type OnboardingFormData = z.infer<typeof onboardingSchema>

const STEPS = ["Personal", "Goals", "Training", "Nutrition", "Constraints", "Review"]
const TOTAL_STEPS = STEPS.length
const STORAGE_KEY = "cooked_onboarding_draft"

export default function OnboardingPage() {
  const router = useRouter()
  const { session, user, loading: sessionLoading } = useSession()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingProfile, setCheckingProfile] = useState(true)

  const profileQuery = useProfile(user?.id)
  const { save } = useOnboardingProfileSave()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    trigger,
    getValues,
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      units: "metric",
      sports: [],
      allergies: [],
      days_off_preference: [],
      hydration_focus: false,
      connect_trainingpeaks: false,
      accept_terms: false,
      data_processing_consent: false,
    },
  })

  // Load draft from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const draft = JSON.parse(saved)
        Object.entries(draft).forEach(([key, value]) => {
          setValue(key as keyof OnboardingFormData, value as OnboardingFormData[keyof OnboardingFormData])
        })
      } catch {
        // Invalid draft, ignore
      }
    }
  }, [setValue])

  // Save draft to localStorage on changes
  const formValues = watch()
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formValues))
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [formValues])

  // Check if profile exists
  const checkProfile = useCallback(async () => {
    if (!session) {
      setCheckingProfile(false)
      return
    }

    if (!profileQuery.isFetched) {
      return
    }

    if (profileQuery.data) {
      router.replace("/dashboard")
      return
    }

    setCheckingProfile(false)
  }, [session, router, profileQuery.data, profileQuery.isFetched])

  useEffect(() => {
    if (!sessionLoading) {
      if (!session) {
        router.replace("/login")
      } else {
        checkProfile()
      }
    }
  }, [session, sessionLoading, router, checkProfile])

  // Set timezone and country from browser
  useEffect(() => {
    if (typeof window !== "undefined") {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setValue("timezone", tz)
    }
  }, [setValue])

  const validateCurrentStep = async () => {
    const stepFields: Record<number, (keyof OnboardingFormData)[]> = {
      1: ["full_name", "weight_kg", "units"],
      2: ["primary_goal", "experience_level"],
      3: ["sports", "typical_workout_time"],
      4: ["diet_type", "meals_per_day", "caffeine"],
      5: [
        "cooking_time_per_day",
        "budget_level",
        "kitchen_access",
        "travel_frequency",
        "accept_terms",
        "data_processing_consent",
      ],
    }

    if (currentStep <= 5) {
      return await trigger(stepFields[currentStep])
    }
    return true
  }

  const handleNext = async () => {
    const isValid = await validateCurrentStep()
    if (isValid && currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const onSubmit = async (data: OnboardingFormData) => {
    setLoading(true)
    setError(null)

    try {
      const payload: OnboardingProfileInput = {
        ...data,
        trainingpeaks_connected: data.connect_trainingpeaks,
      }

      await save(user?.id ?? "", payload, user?.email ?? null)
      localStorage.removeItem(STORAGE_KEY)
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile")
    } finally {
      setLoading(false)
    }
  }

  if (sessionLoading || checkingProfile || profileQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">🥗</span>
          </div>
          <span className="text-white font-semibold text-lg">cooked</span>
        </Link>
        <span className="text-gray-400 text-sm">{user?.email}</span>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 md:px-8 pb-8">
        <div className="max-w-3xl mx-auto">
          <ProgressIndicator steps={STEPS} currentStep={currentStep} />

          <div className="bg-[#111d32] rounded-2xl p-6 md:p-8 mt-8">
            <form onSubmit={handleSubmit(onSubmit)}>
              {error && (
                <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/20">
                  <AlertDescription className="text-red-400">{error}</AlertDescription>
                </Alert>
              )}

              {currentStep === 1 && (
                <StepPersonal register={register} errors={errors} setValue={setValue} watch={watch} />
              )}
              {currentStep === 2 && <StepGoals setValue={setValue} watch={watch} errors={errors} />}
              {currentStep === 3 && <StepTraining setValue={setValue} watch={watch} errors={errors} />}
              {currentStep === 4 && <StepNutrition setValue={setValue} watch={watch} errors={errors} />}
              {currentStep === 5 && <StepConstraints setValue={setValue} watch={watch} errors={errors} />}
              {currentStep === 6 && <ReviewSummary data={getValues()} />}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 1}
                  className="border-white/20 text-white hover:bg-white/5"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>

                <div className="flex gap-3">
                  {currentStep < TOTAL_STEPS ? (
                    <Button type="button" onClick={handleNext} className="bg-green-500 hover:bg-green-600 text-white">
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={loading} className="bg-green-500 hover:bg-green-600 text-white">
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Complete Setup
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}

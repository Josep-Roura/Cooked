"use client"

import type { OnboardingFormData } from "@/app/onboarding/page"
import { Check, Edit2 } from "lucide-react"

interface ReviewSummaryProps {
  data: OnboardingFormData
  onEdit: (step: number) => void
}

export function ReviewSummary({ data, onEdit }: ReviewSummaryProps) {
  return (
    <div className="space-y-6">
      {/* Personal */}
      <div className="bg-white/5 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Personal Information
          </h4>
          <button type="button" onClick={() => onEdit(1)} className="text-gray-400 hover:text-white transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Name:</span> <span className="text-gray-300">{data.full_name || "-"}</span>
          </div>
          <div>
            <span className="text-gray-500">Weight:</span>{" "}
            <span className="text-gray-300">{data.weight_kg ? `${data.weight_kg} kg` : "-"}</span>
          </div>
          <div>
            <span className="text-gray-500">Height:</span>{" "}
            <span className="text-gray-300">{data.height_cm ? `${data.height_cm} cm` : "-"}</span>
          </div>
          <div>
            <span className="text-gray-500">Units:</span> <span className="text-gray-300 capitalize">{data.units}</span>
          </div>
        </div>
      </div>

      {/* Goals */}
      <div className="bg-white/5 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Goals
          </h4>
          <button type="button" onClick={() => onEdit(2)} className="text-gray-400 hover:text-white transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Primary Goal:</span>{" "}
            <span className="text-gray-300 capitalize">{data.primary_goal?.replace("_", " ") || "-"}</span>
          </div>
          <div>
            <span className="text-gray-500">Experience:</span>{" "}
            <span className="text-gray-300 capitalize">{data.experience_level || "-"}</span>
          </div>
          {data.event_name && (
            <div className="col-span-2">
              <span className="text-gray-500">Event:</span> <span className="text-gray-300">{data.event_name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Training */}
      <div className="bg-white/5 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Training Profile
          </h4>
          <button type="button" onClick={() => onEdit(3)} className="text-gray-400 hover:text-white transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Sports:</span>{" "}
            <span className="text-gray-300 capitalize">{data.sports?.join(", ") || "-"}</span>
          </div>
          <div>
            <span className="text-gray-500">Workout Time:</span>{" "}
            <span className="text-gray-300 capitalize">{data.typical_workout_time || "-"}</span>
          </div>
        </div>
      </div>

      {/* Nutrition */}
      <div className="bg-white/5 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Nutrition Preferences
          </h4>
          <button type="button" onClick={() => onEdit(4)} className="text-gray-400 hover:text-white transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Diet:</span>{" "}
            <span className="text-gray-300 capitalize">{data.diet_type || "-"}</span>
          </div>
          <div>
            <span className="text-gray-500">Meals/Day:</span>{" "}
            <span className="text-gray-300">{data.meals_per_day || "-"}</span>
          </div>
          {data.allergies && data.allergies.length > 0 && (
            <div className="col-span-2">
              <span className="text-gray-500">Allergies:</span>{" "}
              <span className="text-gray-300 capitalize">{data.allergies.join(", ")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Constraints */}
      <div className="bg-white/5 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Constraints & Preferences
          </h4>
          <button type="button" onClick={() => onEdit(5)} className="text-gray-400 hover:text-white transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Cooking Time:</span>{" "}
            <span className="text-gray-300">{data.cooking_time_per_day || "-"}</span>
          </div>
          <div>
            <span className="text-gray-500">Budget:</span>{" "}
            <span className="text-gray-300 capitalize">{data.budget_level || "-"}</span>
          </div>
          <div>
            <span className="text-gray-500">Kitchen:</span>{" "}
            <span className="text-gray-300 capitalize">{data.kitchen_access?.replace("_", " ") || "-"}</span>
          </div>
          <div>
            <span className="text-gray-500">TrainingPeaks:</span>{" "}
            <span className="text-gray-300">{data.connect_trainingpeaks ? "Connected" : "Not connected"}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { Check } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"

interface ProgressIndicatorProps {
  currentStep: number
  totalSteps: number
  steps: string[]
}

export function ProgressIndicator({ currentStep, totalSteps, steps }: ProgressIndicatorProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-sm">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-gray-400 text-sm">{steps[currentStep - 1]}</span>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNum = index + 1
          const isCompleted = stepNum < currentStep
          const isCurrent = stepNum === currentStep
          const fillWidth = isCompleted ? "100%" : isCurrent ? "60%" : "0%"

          return (
            <div key={index} className="flex-1 relative">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className={isCompleted ? "bg-green-500" : "bg-green-500/50"}
                  animate={{ width: fillWidth }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
                  style={{ height: "100%" }}
                />
              </div>
              {isCompleted && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

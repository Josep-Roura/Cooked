"use client"

import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface CardRadioOption {
  value: string
  label: string
  description?: string
}

interface CardRadioGroupProps {
  options: CardRadioOption[]
  value?: string[] | string
  onChange: (value: string[] | string) => void
  multiple?: boolean
  className?: string
}

export function CardRadioGroup({ options, value, onChange, multiple = false, className }: CardRadioGroupProps) {
  const prefersReducedMotion = useReducedMotion()
  const currentValues = Array.isArray(value) ? value : value ? [value] : []

  const handleSelection = (optionValue: string) => {
    if (multiple) {
      if (currentValues.includes(optionValue)) {
        onChange(currentValues.filter((item) => item !== optionValue))
      } else {
        onChange([...currentValues, optionValue])
      }
      return
    }

    onChange(optionValue)
  }

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {options.map((option) => {
        const isSelected = currentValues.includes(option.value)
        return (
          <motion.button
            key={option.value}
            type="button"
            onClick={() => handleSelection(option.value)}
            className={cn(
              "p-4 rounded-lg border transition-all text-left",
              isSelected
                ? "bg-green-500/20 border-green-500 text-white"
                : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20",
            )}
            animate={
              prefersReducedMotion
                ? undefined
                : {
                    scale: isSelected ? 1.02 : 1,
                    opacity: isSelected ? 1 : 0.9,
                  }
            }
            transition={prefersReducedMotion ? undefined : { duration: 0.18 }}
            aria-pressed={isSelected}
          >
            <div className="text-sm font-medium">{option.label}</div>
            {option.description && <div className="text-xs text-gray-400 mt-1">{option.description}</div>}
          </motion.button>
        )
      })}
    </div>
  )
}

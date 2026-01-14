"use client"

import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface ChipOption {
  value: string
  label: string
}

interface SelectableChipsProps {
  options: ChipOption[]
  value?: string[] | string
  onChange: (value: string[] | string) => void
  multiple?: boolean
  className?: string
  chipClassName?: string
  selectedClassName?: string
  unselectedClassName?: string
}

export function SelectableChips({
  options,
  value,
  onChange,
  multiple = false,
  className,
  chipClassName,
  selectedClassName,
  unselectedClassName,
}: SelectableChipsProps) {
  const prefersReducedMotion = useReducedMotion()
  const currentValues = Array.isArray(value) ? value : value ? [value] : []

  const handleToggle = (optionValue: string) => {
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
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const isSelected = currentValues.includes(option.value)
        return (
          <motion.button
            key={option.value}
            type="button"
            onClick={() => handleToggle(option.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm transition-colors",
              chipClassName,
              isSelected
                ? "bg-green-500 text-white"
                : "bg-white/5 text-gray-400 hover:bg-white/10",
              isSelected ? selectedClassName : unselectedClassName,
            )}
            animate={
              prefersReducedMotion
                ? undefined
                : {
                    scale: isSelected ? 1.03 : 1,
                    opacity: isSelected ? 1 : 0.9,
                  }
            }
            transition={prefersReducedMotion ? undefined : { duration: 0.18 }}
            aria-pressed={isSelected}
          >
            {option.label}
          </motion.button>
        )
      })}
    </div>
  )
}

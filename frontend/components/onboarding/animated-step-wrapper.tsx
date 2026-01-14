"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface AnimatedStepWrapperProps {
  stepKey: string | number
  children: ReactNode
  className?: string
}

export function AnimatedStepWrapper({ stepKey, children, className }: AnimatedStepWrapperProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stepKey}
        className={cn("space-y-6", className)}
        initial={
          prefersReducedMotion
            ? false
            : {
                opacity: 0,
                y: 12,
              }
        }
        animate={
          prefersReducedMotion
            ? { opacity: 1 }
            : {
                opacity: 1,
                y: 0,
              }
        }
        exit={
          prefersReducedMotion
            ? { opacity: 0 }
            : {
                opacity: 0,
                y: -12,
              }
        }
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

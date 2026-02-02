"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { addDays, format, isSameDay } from "date-fns"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

type DashboardDateContextValue = {
  selectedDate: Date
  selectedDateKey: string
  setSelectedDate: (date: Date) => void
  nextDay: () => void
  prevDay: () => void
  setFromWeekDayClick: (date: Date) => void
}

const DashboardDateContext = createContext<DashboardDateContextValue | null>(null)

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function parseDateParam(value: string | null) {
  if (!value || !DATE_REGEX.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function DashboardDateProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  // Read initial date from URL or default to today - only once on mount
  const initialDate = useMemo(() => {
    const paramDate = parseDateParam(searchParams.get("date"))
    return paramDate ?? new Date()
  }, []) // Empty deps = only on mount
  
  const [selectedDate, setSelectedDateState] = useState<Date>(initialDate)
  
  // Track if we're currently updating to prevent loops
  const isUpdatingRef = useRef(false)
  const lastUpdatedUrlRef = useRef<string | null>(null)
  
  // Compute selectedDateKey from state
  const selectedDateKey = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate])
  
  // Single effect to sync URL when state changes
  useEffect(() => {
    // Skip if we're already in the middle of an update
    if (isUpdatingRef.current) return
    
    const currentUrlDate = searchParams.get("date")
    
    // Only update URL if the date is actually different
    if (currentUrlDate === selectedDateKey) return
    
    // Prevent duplicate updates
    if (lastUpdatedUrlRef.current === selectedDateKey) return
    
    // Mark that we're updating
    isUpdatingRef.current = true
    lastUpdatedUrlRef.current = selectedDateKey
    
    // Build new URL
    const params = new URLSearchParams(searchParams.toString())
    params.set("date", selectedDateKey)
    const newUrl = `${pathname}?${params.toString()}`
    
    // Use setTimeout to break the synchronous cycle
    setTimeout(() => {
      router.replace(newUrl, { scroll: false })
      // Reset flag after a short delay
      setTimeout(() => {
        isUpdatingRef.current = false
      }, 50)
    }, 0)
  }, [pathname, router, selectedDateKey]) // Removed searchParams dependency

  const setSelectedDate = useCallback((date: Date) => {
    setSelectedDateState(date)
  }, [])

  const nextDay = useCallback(() => {
    setSelectedDateState((prev) => addDays(prev, 1))
  }, [])

  const prevDay = useCallback(() => {
    setSelectedDateState((prev) => addDays(prev, -1))
  }, [])

  const setFromWeekDayClick = useCallback((date: Date) => {
    setSelectedDateState(date)
  }, [])

  const value = useMemo(
    () => ({
      selectedDate,
      selectedDateKey,
      setSelectedDate,
      nextDay,
      prevDay,
      setFromWeekDayClick,
    }),
    [nextDay, prevDay, selectedDate, selectedDateKey, setFromWeekDayClick, setSelectedDate],
  )

  return <DashboardDateContext.Provider value={value}>{children}</DashboardDateContext.Provider>
}

export function useDashboardDate() {
  const context = useContext(DashboardDateContext)
  if (!context) {
    throw new Error("useDashboardDate must be used within DashboardDateProvider")
  }
  return context
}

"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
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
  const paramDate = parseDateParam(searchParams.get("date"))
  const [selectedDate, setSelectedDateState] = useState<Date>(() => paramDate ?? new Date())

  useEffect(() => {
    if (!paramDate) return
    if (!isSameDay(paramDate, selectedDate)) {
      setSelectedDateState(paramDate)
    }
  }, [paramDate, selectedDate])

  const selectedDateKey = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate])

  useEffect(() => {
    const current = searchParams.get("date")
    if (current === selectedDateKey) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("date", selectedDateKey)
    const nextUrl = `${pathname}?${params.toString()}`
    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParams, selectedDateKey])

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

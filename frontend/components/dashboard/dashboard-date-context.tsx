"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { addDays, format, parseISO } from "date-fns"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

interface DashboardDateContextValue {
  selectedDate: Date
  setSelectedDate: (date: Date) => void
  nextDay: () => void
  prevDay: () => void
  setFromWeekDayClick: (date: Date) => void
}

const DashboardDateContext = createContext<DashboardDateContextValue | null>(null)

function parseDateParam(value: string | null) {
  if (!value) return null
  const parsed = parseISO(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function DashboardDateProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selectedDate, setSelectedDateState] = useState<Date>(() => new Date())

  useEffect(() => {
    const paramDate = parseDateParam(searchParams.get("date"))
    if (paramDate) {
      setSelectedDateState(paramDate)
    }
  }, [searchParams])

  const updateUrl = useCallback(
    (date: Date) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("date", format(date, "yyyy-MM-dd"))
      router.replace(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams],
  )

  const setSelectedDate = useCallback(
    (date: Date) => {
      setSelectedDateState(date)
      updateUrl(date)
    },
    [updateUrl],
  )

  const nextDay = useCallback(() => {
    setSelectedDate(addDays(selectedDate, 1))
  }, [selectedDate, setSelectedDate])

  const prevDay = useCallback(() => {
    setSelectedDate(addDays(selectedDate, -1))
  }, [selectedDate, setSelectedDate])

  const setFromWeekDayClick = useCallback(
    (date: Date) => {
      setSelectedDate(date)
    },
    [setSelectedDate],
  )

  const value = useMemo(
    () => ({ selectedDate, setSelectedDate, nextDay, prevDay, setFromWeekDayClick }),
    [selectedDate, setSelectedDate, nextDay, prevDay, setFromWeekDayClick],
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

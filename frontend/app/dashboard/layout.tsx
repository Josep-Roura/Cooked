"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardShell } from "@/components/dashboard/shell"
import { DashboardDateProvider } from "@/components/dashboard/dashboard-date-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { useSession } from "@/hooks/use-session"
import { useProfile } from "@/lib/db/hooks"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const { session, loading } = useSession()
  const profileQuery = useProfile(session?.user.id)

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login")
    }
  }, [loading, router, session])

  useEffect(() => {
    if (!loading && session && profileQuery.isFetched && profileQuery.data === null) {
      router.replace("/onboarding")
    }
  }, [loading, profileQuery.data, profileQuery.isFetched, router, session])

  if (loading || (session && profileQuery.isLoading)) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (!session || profileQuery.data === null) {
    return null
  }

  return (
    <DashboardDateProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardDateProvider>
  )
}

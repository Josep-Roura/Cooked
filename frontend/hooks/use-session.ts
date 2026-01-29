"use client"

import { useEffect, useState, useCallback } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import type { Session, User } from "@supabase/supabase-js"

interface SessionState {
  session: Session | null
  user: User | null
  loading: boolean
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    session: null,
    user: null,
    loading: true,
  })

  const fetchSession = useCallback(async () => {
    const supabase = getSupabaseClient()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const projectRef = supabaseUrl?.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1]
    const storageKey = projectRef ? `sb-${projectRef}-auth-token` : null

    if (typeof window !== "undefined" && storageKey && !window.localStorage.getItem(storageKey)) {
      setState({
        session: null,
        user: null,
        loading: false,
      })
      return
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setState({
        session,
        user: session?.user ?? null,
        loading: false,
      })
    } catch {
      setState({
        session: null,
        user: null,
        loading: false,
      })
    }
  }, [])

  useEffect(() => {
    fetchSession()

    const supabase = getSupabaseClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
      })
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchSession])

  return state
}

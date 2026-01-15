"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AuthCard } from "@/components/auth/auth-card"
import { PasswordField } from "@/components/auth/password-field"
import { OAuthButtons } from "@/components/auth/oauth-buttons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { signIn } from "@/lib/auth"
import { useSession } from "@/hooks/use-session"
import { useProfile } from "@/lib/db/hooks"
import { z } from "zod"
import { Loader2 } from "lucide-react"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export default function LoginPage() {
  const router = useRouter()
  const { session, user, loading: sessionLoading } = useSession()
  const profileQuery = useProfile(user?.id)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  useEffect(() => {
    if (!sessionLoading && session && profileQuery.isFetched) {
      if (profileQuery.data) {
        router.replace("/dashboard")
      } else {
        router.replace("/onboarding")
      }
    }
  }, [session, sessionLoading, router, profileQuery.isFetched, profileQuery.data])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setErrors({})

    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {}
      result.error.errors.forEach((err) => {
        if (err.path[0] === "email") fieldErrors.email = err.message
        if (err.path[0] === "password") fieldErrors.password = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      await signIn(email, password)
      const profile = await profileQuery.refetch()
      if (profile.data) {
        router.push("/dashboard")
      } else {
        router.push("/onboarding")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in")
    } finally {
      setLoading(false)
    }
  }

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    )
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to continue to Cooked AI"
      footer={
        <p className="text-gray-400 text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-green-500 hover:text-green-400 font-medium">
            Sign up
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-300 text-sm">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="bg-[#0a1628] border-white/20 text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20"
          />
          {errors.email && <p className="text-red-400 text-xs">{errors.email}</p>}
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          disabled={loading}
        />

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-green-500 hover:text-green-400">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          className="w-full bg-green-500 hover:bg-green-600 text-white rounded-full h-11"
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Sign in
        </Button>

        <OAuthButtons disabled={loading} />
      </form>
    </AuthCard>
  )
}

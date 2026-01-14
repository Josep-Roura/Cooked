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
import { signUp } from "@/lib/auth"
import { useSession } from "@/hooks/use-session"
import { z } from "zod"
import { Loader2, CheckCircle } from "lucide-react"

const signupSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

export default function SignupPage() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({})

  useEffect(() => {
    if (!sessionLoading && session) {
      router.replace("/onboarding")
    }
  }, [session, sessionLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setErrors({})

    const result = signupSchema.safeParse({ email, password, confirmPassword })
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string; confirmPassword?: string } = {}
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof typeof fieldErrors
        fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      await signUp(email, password)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account")
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

  if (success) {
    return (
      <AuthCard title="Check your email" description="We sent you a confirmation link">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-gray-400 text-sm">
            We&apos;ve sent a confirmation email to <span className="text-white font-medium">{email}</span>. Please
            click the link to verify your account.
          </p>
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/5 bg-transparent"
            onClick={() => router.push("/login")}
          >
            Back to login
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Create your account"
      description="Start optimizing your nutrition today"
      footer={
        <p className="text-gray-400 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-green-500 hover:text-green-400 font-medium">
            Sign in
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

        <PasswordField
          id="confirmPassword"
          label="Confirm Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={errors.confirmPassword}
          disabled={loading}
        />

        <Button
          type="submit"
          className="w-full bg-green-500 hover:bg-green-600 text-white rounded-full h-11"
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Create account
        </Button>

        <OAuthButtons disabled={loading} />
      </form>
    </AuthCard>
  )
}

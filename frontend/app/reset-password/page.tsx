"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AuthCard } from "@/components/auth/auth-card"
import { PasswordField } from "@/components/auth/password-field"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updatePassword } from "@/lib/auth"
import { z } from "zod"
import { Loader2, CheckCircle } from "lucide-react"

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setErrors({})

    const result = resetPasswordSchema.safeParse({ password, confirmPassword })
    if (!result.success) {
      const fieldErrors: { password?: string; confirmPassword?: string } = {}
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof typeof fieldErrors
        fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      await updatePassword(password)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthCard title="Password updated" description="Your password has been successfully reset">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-gray-400 text-sm">You can now sign in with your new password.</p>
          <Button
            className="bg-green-500 hover:bg-green-600 text-white rounded-full"
            onClick={() => router.push("/login")}
          >
            Sign in
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your new password below"
      footer={
        <Link href="/login" className="text-gray-400 hover:text-white text-sm">
          Back to login
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        <PasswordField
          id="password"
          label="New Password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          disabled={loading}
        />

        <PasswordField
          id="confirmPassword"
          label="Confirm New Password"
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
          Update password
        </Button>
      </form>
    </AuthCard>
  )
}

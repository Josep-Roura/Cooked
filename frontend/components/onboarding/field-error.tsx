"use client"

interface FieldErrorProps {
  message?: string
}

export function FieldError({ message }: FieldErrorProps) {
  if (!message) {
    return null
  }

  return <p className="text-red-400 text-xs">{message}</p>
}

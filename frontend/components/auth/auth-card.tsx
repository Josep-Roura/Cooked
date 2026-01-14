"use client"

import Link from "next/link"
import type { ReactNode } from "react"

interface AuthCardProps {
  children: ReactNode
  title: string
  description?: string
  footer?: ReactNode
}

export function AuthCard({ children, title, description, footer }: AuthCardProps) {
  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">🥗</span>
          </div>
          <span className="text-white font-semibold text-lg">cooked</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          <div className="bg-[#111d32] border border-white/10 rounded-2xl p-8 shadow-xl">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
              {description && <p className="text-gray-400 text-sm">{description}</p>}
            </div>
            {children}
          </div>
          {footer && <div className="mt-6 text-center">{footer}</div>}
        </div>
      </main>
    </div>
  )
}

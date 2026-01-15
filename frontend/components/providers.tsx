"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const [client] = useState(() => new QueryClient())

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={client}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

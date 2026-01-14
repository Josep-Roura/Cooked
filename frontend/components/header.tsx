import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a1628]/95 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">🥗</span>
            </div>
            <span className="text-white font-semibold text-lg">cooked</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-gray-300 hover:text-white text-sm transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="text-gray-300 hover:text-white text-sm transition-colors">
              Pricing
            </Link>
            <Link href="#blog" className="text-gray-300 hover:text-white text-sm transition-colors">
              Blog
            </Link>
            <Link href="#about" className="text-gray-300 hover:text-white text-sm transition-colors">
              About
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/10 text-sm">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-green-500 hover:bg-green-600 text-white text-sm rounded-full px-4">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

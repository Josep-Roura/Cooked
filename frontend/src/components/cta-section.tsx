import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function CtaSection() {
  return (
    <section className="py-20 bg-[#0a1628]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Start planning your nutrition from your training
          </h2>
          <p className="text-gray-400 mb-8">
            Join thousands of athletes who have optimized their nutrition with Cooked.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-md mx-auto mb-6">
            <Input
              type="email"
              placeholder="Enter your email"
              className="h-12 rounded-full px-6 bg-[#111d32] border-gray-700 text-white placeholder:text-gray-500 flex-1"
            />
            <Button className="bg-green-500 hover:bg-green-600 text-white rounded-full h-12 px-6 whitespace-nowrap">
              Get Started →
            </Button>
          </div>

          <p className="text-gray-500 text-sm">Free to start. No credit card required.</p>
        </div>
      </div>
    </section>
  )
}

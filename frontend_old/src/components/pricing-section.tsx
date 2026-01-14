import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

export default function PricingSection() {
  return (
    <section className="py-20 bg-[#0a1628]" id="pricing">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-green-500 text-sm font-medium mb-4 block">PRICING</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Simple pricing,
            <br />
            built for athletes
          </h2>
          <p className="text-gray-400">Choose the plan that fits your goals.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Free Plan */}
          <div className="bg-[#111d32] rounded-2xl p-6 border border-gray-800">
            <h3 className="text-white font-semibold mb-2">Starter</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">FREE</span>
            </div>
            <p className="text-gray-400 text-sm mb-6">Perfect for trying out Cooked</p>
            <Button
              variant="outline"
              className="w-full mb-6 border-gray-600 text-white hover:bg-white/10 bg-transparent"
            >
              Get Started
            </Button>
            <ul className="space-y-3">
              {["Basic daily planning", "1 platform integration", "7-day history"].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-400 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro Plan */}
          <div className="bg-[#111d32] rounded-2xl p-6 border-2 border-green-500 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-3 py-1 rounded-full">
              Most Popular
            </div>
            <h3 className="text-white font-semibold mb-2">Pro</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">$25</span>
              <span className="text-gray-400">/month</span>
            </div>
            <p className="text-gray-400 text-sm mb-6">For serious athletes</p>
            <Button className="w-full mb-6 bg-green-500 hover:bg-green-600 text-white">Start Free Trial</Button>
            <ul className="space-y-3">
              {[
                "Advanced daily planning",
                "Unlimited integrations",
                "AI chat assistant",
                "Full history & analytics",
                "Recipe customization",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-400 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Team Plan */}
          <div className="bg-[#111d32] rounded-2xl p-6 border border-gray-800">
            <h3 className="text-white font-semibold mb-2">Team</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">$35</span>
              <span className="text-gray-400">/month</span>
            </div>
            <p className="text-gray-400 text-sm mb-6">For coaches and teams</p>
            <Button
              variant="outline"
              className="w-full mb-6 border-gray-600 text-white hover:bg-white/10 bg-transparent"
            >
              Contact Sales
            </Button>
            <ul className="space-y-3">
              {[
                "Everything in Pro",
                "Team management",
                "Coach dashboard",
                "Priority support",
                "Custom integrations",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-400 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

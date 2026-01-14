import Image from "next/image"

export default function NutritionChangesSection() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="relative">
            <div className="relative w-64 h-[500px] mx-auto">
              <Image src="/iphone-mockup-showing-nutrition-app-with-meal-deta.jpg" alt="Mobile app" fill className="object-contain" />
            </div>
          </div>

          <div>
            <span className="text-green-500 text-sm font-medium mb-4 block">ADAPTIVE</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Your nutrition changes when your training changes
            </h2>
            <p className="text-gray-600 mb-8">
              Whether it&apos;s an easy recovery day or a hard interval session, your nutrition plan automatically
              adjusts to match.
            </p>

            <div className="space-y-4">
              {[
                { icon: "🏃", title: "Training intensity", desc: "Higher intensity = more carbs" },
                { icon: "💪", title: "Recovery needs", desc: "Post-workout protein optimization" },
                { icon: "😴", title: "Rest days", desc: "Lower calories, maintained protein" },
                { icon: "📈", title: "Progressive adaptation", desc: "Learns your patterns over time" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">{item.icon}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-gray-600 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

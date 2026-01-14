export default function TodayTrainingSection() {
  return (
    <section className="py-20 bg-[#0a1628]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-green-500 text-sm font-medium mb-4 block">DAILY PLANNING</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Everything you need for today&apos;s training — <span className="text-green-500">nothing more</span>.
            </h2>
            <p className="text-gray-400 mb-8">
              Every morning you get a personalized nutrition plan based on what&apos;s actually on your training
              schedule. No unnecessary complexity.
            </p>

            <div className="bg-[#111d32] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white font-medium">Tuesday - Moderate Training</p>
                  <p className="text-gray-500 text-sm">Based on your scheduled interval session</p>
                </div>
                <div className="text-right">
                  <p className="text-green-500 text-sm">→ expanded fueling</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#1a2744] rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">2,650</p>
                  <p className="text-gray-500 text-xs">Calories</p>
                </div>
                <div className="bg-[#1a2744] rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">175g</p>
                  <p className="text-gray-500 text-xs">Protein</p>
                </div>
                <div className="bg-[#1a2744] rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">320g</p>
                  <p className="text-gray-500 text-xs">Carbs</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="bg-[#111d32] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white">🥗</span>
                </div>
                <div>
                  <p className="text-white font-medium">Today&apos;s Meals</p>
                  <p className="text-gray-500 text-sm">4 meals planned</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { time: "7:00 AM", meal: "Pre-Workout Oats", cal: "480 cal", icon: "🌅" },
                  { time: "10:30 AM", meal: "Recovery Shake", cal: "320 cal", icon: "🥤" },
                  { time: "1:00 PM", meal: "Chicken & Rice Bowl", cal: "680 cal", icon: "🍗" },
                  { time: "7:00 PM", meal: "Salmon & Vegetables", cal: "550 cal", icon: "🐟" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#1a2744] rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{item.icon}</span>
                      <div>
                        <p className="text-white text-sm">{item.meal}</p>
                        <p className="text-gray-500 text-xs">{item.time}</p>
                      </div>
                    </div>
                    <span className="text-green-500 text-sm">{item.cal}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

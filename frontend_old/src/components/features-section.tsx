export default function FeaturesSection() {
  return (
    <section className="py-20 bg-white" id="features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-green-500 text-sm font-medium mb-4 block">HOW IT WORKS</span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">No generic diets.</h2>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Every day adapts to your training load and intensity.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Daily decisions, not weekly</h3>
            <p className="text-gray-600 text-sm mb-4">
              Most meal plans are static. Cooked adapts daily based on your actual training data.
            </p>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Training Impact</span>
                <span className="text-xs text-green-500">+12%</span>
              </div>
              <div className="h-16 bg-gradient-to-r from-green-100 to-green-50 rounded-lg flex items-end p-2">
                <div className="flex gap-1 items-end w-full">
                  {[30, 45, 60, 40, 70, 55, 80].map((h, i) => (
                    <div key={i} className="flex-1 bg-green-400 rounded-t" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Fully actionable</h3>
            <p className="text-gray-600 text-sm mb-4">
              Get specific meal recommendations, not just macro targets. Easy to follow recipes.
            </p>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🍳</span>
                </div>
                <div>
                  <p className="font-medium text-sm">Protein Oatmeal</p>
                  <p className="text-xs text-gray-500">420 cal • 32g protein</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Quick</span>
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">High Protein</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Science-backed but easy</h3>
            <p className="text-gray-600 text-sm mb-4">
              Built on sports nutrition research, presented in a way anyone can understand.
            </p>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Recovery Score</span>
                <span className="text-green-500 font-bold">92%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: "92%" }}></div>
              </div>
              <p className="text-xs text-gray-500">Optimal protein timing achieved</p>
            </div>
          </div>
        </div>

        {/* Additional Feature Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">API powered</h3>
            <p className="text-gray-600 text-sm mb-4">
              Connects to all major training platforms. Your data syncs automatically.
            </p>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center text-white text-xs">
                    S
                  </div>
                  <div className="w-8 h-8 bg-black rounded-full border-2 border-white flex items-center justify-center text-white text-xs">
                    G
                  </div>
                  <div className="w-8 h-8 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center text-white text-xs">
                    T
                  </div>
                </div>
                <span className="text-sm text-gray-600">Connected platforms</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">One plan, the whole day</h3>
            <p className="text-gray-600 text-sm mb-4">
              From breakfast to dinner, timing to portions. Everything planned around your schedule.
            </p>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-500">🌅</span>
                    <span className="text-sm">Breakfast</span>
                  </div>
                  <span className="text-xs text-gray-500">7:00 AM</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-orange-500">☀️</span>
                    <span className="text-sm">Lunch</span>
                  </div>
                  <span className="text-xs text-gray-500">12:30 PM</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-500">🌙</span>
                    <span className="text-sm">Dinner</span>
                  </div>
                  <span className="text-xs text-gray-500">7:00 PM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"

export default function HeroSection() {
  return (
    <section className="pt-24 pb-16 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm mb-6">
            <span className="text-green-500 text-xs font-medium">✨ NEW FEATURE UPDATE</span>
            <span className="text-gray-400 mx-2">•</span>
            <span className="text-gray-600 text-xs">SEE WHAT'S NEW</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Daily nutrition, built <span className="text-green-500">directly</span> from
            <br />
            your training
          </h1>

          <p className="text-gray-600 text-lg max-w-2xl mx-auto mb-8">
            No generic diets. No guessing macros. Cooked uses your real training data to plan and adjust your nutrition
            daily, automatically.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-md mx-auto mb-8">
            <Input
              type="email"
              placeholder="Enter your email"
              className="h-12 rounded-full px-6 bg-white border-gray-200 flex-1"
            />
            <Button className="bg-green-500 hover:bg-green-600 text-white rounded-full h-12 px-6 whitespace-nowrap">
              Try It Free →
            </Button>
          </div>

          <p className="text-gray-400 text-sm mb-12">Start free. No credit card required.</p>
        </div>

        {/* Dashboard Preview */}
        <div className="relative max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
            <div className="p-6">
              <div className="grid grid-cols-12 gap-4">
                {/* Sidebar */}
                <div className="col-span-3 space-y-4">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-6 h-6 bg-green-500 rounded-full"></div>
                    <span className="font-semibold text-sm">cooked</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-green-500 bg-green-50 rounded-lg p-2">
                      <span>📊</span> Dashboard
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 p-2">
                      <span>📅</span> Meal Plan
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 p-2">
                      <span>📈</span> Progress
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 p-2">
                      <span>⚙️</span> Settings
                    </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="col-span-9">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">Today&apos;s Overview</h3>
                    <span className="text-sm text-gray-500">January 14, 2026</span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Calories</p>
                      <p className="text-2xl font-bold">2,450</p>
                      <p className="text-xs text-green-500">+150 from base</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Training Load</p>
                      <p className="text-2xl font-bold">High</p>
                      <p className="text-xs text-orange-500">90 TSS</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Protein Target</p>
                      <p className="text-2xl font-bold">165g</p>
                      <p className="text-xs text-blue-500">Recovery focus</p>
                    </div>
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-2">Weekly Macro Distribution</p>
                      <div className="flex items-end gap-1 h-24">
                        {[40, 60, 45, 80, 55, 70, 65].map((h, i) => (
                          <div key={i} className="flex-1 bg-green-400 rounded-t" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-2">Calorie Trend</p>
                      <svg viewBox="0 0 200 80" className="w-full h-24">
                        <path
                          d="M0,60 Q30,50 50,55 T100,40 T150,45 T200,30"
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="2"
                        />
                        <path
                          d="M0,60 Q30,50 50,55 T100,40 T150,45 T200,30 L200,80 L0,80 Z"
                          fill="url(#gradient)"
                          opacity="0.2"
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#22c55e" />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Donut Chart Overlay */}
          <div className="absolute -right-4 top-1/4 bg-white rounded-xl shadow-lg p-4 border border-gray-100">
            <div className="w-20 h-20 relative">
              <svg viewBox="0 0 36 36" className="w-full h-full">
                <path
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="3"
                  strokeDasharray="75, 100"
                />
                <path
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="3"
                  strokeDasharray="15, 100"
                  strokeDashoffset="-75"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold">75%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Integration Logos */}
        <div className="flex flex-wrap justify-center items-center gap-8 mt-12 opacity-60">
          <Image src="/garmin-logo-gray.jpg" alt="Garmin" width={80} height={24} />
          <Image src="/wahoo-logo-gray.jpg" alt="Wahoo" width={80} height={24} />
          <Image src="/oura-ring-logo-gray.jpg" alt="Oura" width={80} height={24} />
          <Image src="/strava-logo-gray.jpg" alt="Strava" width={80} height={24} />
          <Image src="/trainingpeaks-logo-gray.jpg" alt="TrainingPeaks" width={80} height={24} />
        </div>
      </div>
    </section>
  )
}

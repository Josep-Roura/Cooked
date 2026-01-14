import Image from "next/image"

export default function GlobeSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-white to-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex justify-center items-center">
          <div className="relative w-80 h-80 md:w-[500px] md:h-[500px]">
            <Image src="/3d-rendered-realistic-earth-globe-with-glowing-gre.jpg" alt="Global connectivity" fill className="object-contain" />
          </div>

          {/* Floating UI Cards */}
          <div className="absolute left-0 top-1/4 bg-white rounded-xl shadow-lg p-3 max-w-[140px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-xs">🏃</span>
              </div>
              <span className="text-xs font-medium">Morning Run</span>
            </div>
            <p className="text-xs text-gray-500">8.5 km • 45 min</p>
          </div>

          <div className="absolute right-0 bottom-1/4 bg-white rounded-xl shadow-lg p-3 max-w-[160px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-xs">🍽️</span>
              </div>
              <span className="text-xs font-medium">Adjusted Plan</span>
            </div>
            <p className="text-xs text-gray-500">+200 cal for recovery</p>
          </div>
        </div>
      </div>
    </section>
  )
}

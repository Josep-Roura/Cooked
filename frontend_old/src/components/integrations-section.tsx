export default function IntegrationsSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Works with the tools you
            <br />
            already use
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Connect your favorite training platforms and let Cooked do the rest. No manual data entry required.
          </p>
        </div>

        <div className="relative py-12">
          <div className="flex justify-center items-center">
            {/* Center Logo */}
            <div className="relative z-10 w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">C</span>
            </div>
          </div>

          {/* Orbiting Logos */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-80 h-80">
              {[
                { name: "TP", color: "bg-blue-600", position: "top-0 left-1/2 -translate-x-1/2" },
                { name: "S", color: "bg-orange-500", position: "top-1/4 right-0" },
                { name: "G", color: "bg-black", position: "bottom-1/4 right-0" },
                { name: "W", color: "bg-blue-400", position: "bottom-0 left-1/2 -translate-x-1/2" },
                { name: "O", color: "bg-gray-200 text-gray-800", position: "bottom-1/4 left-0" },
                { name: "Z", color: "bg-red-500", position: "top-1/4 left-0" },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`absolute ${item.position} w-12 h-12 ${item.color} rounded-full flex items-center justify-center text-white font-bold shadow-md`}
                >
                  {item.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

import Image from "next/image"

export default function EverythingYouNeedSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything you need — without
            <br />
            unnecessary complexity
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Cooked is designed to be simple and effective. It does the work for you, so you can focus on your training.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-gray-50 rounded-2xl p-6">
            <div className="mb-4">
              <Image
                src="/clean-mobile-app-interface-showing-automatic-meal-.jpg"
                alt="Automatic re-planning"
                width={300}
                height={200}
                className="rounded-xl w-full"
              />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Automatic re-planning</h3>
            <p className="text-gray-600 text-sm">
              Plans change. Your nutrition adapts automatically when your training schedule shifts.
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6">
            <div className="mb-4">
              <Image
                src="/mobile-chat-interface-with-ai-assistant-discussing.jpg"
                alt="Talk to your plan"
                width={300}
                height={200}
                className="rounded-xl w-full"
              />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Talk to your plan</h3>
            <p className="text-gray-600 text-sm">
              Ask questions, request changes, or get explanations. Your plan responds like a coach.
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6">
            <div className="mb-4">
              <Image
                src="/mobile-app-showing-nutrition-reasoning-and-explana.jpg"
                alt="Clean reasoning"
                width={300}
                height={200}
                className="rounded-xl w-full"
              />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Clean reasoning</h3>
            <p className="text-gray-600 text-sm">Understand why each recommendation is made. No black box decisions.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

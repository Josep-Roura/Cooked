import Image from "next/image"
import { Star } from "lucide-react"

export default function TestimonialsSection() {
  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Marathon Runner",
      avatar: "/female-athlete-portrait-professional-headshot.jpg",
      content:
        "Cooked has completely changed how I approach nutrition. No more guessing, no more generic plans. Every day is tailored to my actual training.",
      rating: 5,
    },
    {
      name: "Mike Chen",
      role: "Triathlete",
      avatar: "/male-athlete-portrait-professional-headshot-asian.jpg",
      content:
        "As a triathlete, my training varies wildly day to day. Cooked keeps up perfectly and my energy levels have never been more consistent.",
      rating: 5,
    },
    {
      name: "Emma Davis",
      role: "CrossFit Competitor",
      avatar: "/placeholder.svg?height=48&width=48",
      content:
        "I used to spend hours planning meals. Now Cooked does it automatically and I can focus on what matters: training hard and recovering well.",
      rating: 5,
    },
  ]

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-green-500 text-sm font-medium mb-4 block">TESTIMONIALS</span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            What athletes say after
            <br />
            using Cooked AI
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, i) => (
            <div key={i} className="bg-gray-50 rounded-2xl p-6">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 mb-6">&quot;{testimonial.content}&quot;</p>
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-full overflow-hidden">
                  <Image
                    src={testimonial.avatar || "/placeholder.svg"}
                    alt={testimonial.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{testimonial.name}</p>
                  <p className="text-gray-500 text-sm">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

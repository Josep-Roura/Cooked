import Image from "next/image"
import { ArrowRight } from "lucide-react"

export default function BlogSection() {
  const posts = [
    {
      image: "/athlete-drinking-water-during-exercise-sports-nutr.jpg",
      title: "Why athletes need more than generic meal plans",
      excerpt: "Understanding the science of periodized nutrition",
      date: "Jan 10, 2026",
    },
    {
      image: "/healthy-meal-prep-containers-with-chicken-rice-veg.jpg",
      title: "How to optimize your fueling for interval training",
      excerpt: "The timing and composition that actually works",
      date: "Jan 8, 2026",
    },
    {
      image: "/runner-stretching-recovery-post-workout-sunset-pho.jpg",
      title: "Recovery nutrition: What the research says",
      excerpt: "A 30-minute window or does timing even matter?",
      date: "Jan 5, 2026",
    },
  ]

  return (
    <section className="py-20 bg-gray-50" id="blog">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Learn how to fuel your training properly
            </h2>
            <p className="text-gray-600">Science-backed insights for athletes who want to perform better.</p>
          </div>
          <a href="#" className="hidden md:flex items-center gap-2 text-green-500 font-medium hover:text-green-600">
            View all posts <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {posts.map((post, i) => (
            <article
              key={i}
              className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="relative h-48">
                <Image src={post.image || "/placeholder.svg"} alt={post.title} fill className="object-cover" />
              </div>
              <div className="p-6">
                <p className="text-gray-500 text-sm mb-2">{post.date}</p>
                <h3 className="font-semibold text-gray-900 mb-2">{post.title}</h3>
                <p className="text-gray-600 text-sm">{post.excerpt}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

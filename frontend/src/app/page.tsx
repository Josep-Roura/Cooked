import Header from "@/components/header"
import HeroSection from "@/components/hero-section"
import FeaturesSection from "@/components/features-section"
import GlobeSection from "@/components/globe-section"
import TodayTrainingSection from "@/components/today-training-section"
import EverythingYouNeedSection from "@/components/everything-you-need-section"
import NutritionChangesSection from "@/components/nutrition-changes-section"
import IntegrationsSection from "@/components/integrations-section"
import PricingSection from "@/components/pricing-section"
import BlogSection from "@/components/blog-section"
import TestimonialsSection from "@/components/testimonials-section"
import CtaSection from "@/components/cta-section"
import Footer from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <HeroSection />
      <FeaturesSection />
      <GlobeSection />
      <TodayTrainingSection />
      <EverythingYouNeedSection />
      <NutritionChangesSection />
      <IntegrationsSection />
      <PricingSection />
      <BlogSection />
      <TestimonialsSection />
      <CtaSection />
      <Footer />
    </main>
  )
}

import { FeatureCards } from "./feature-cards";
import { FinalCta } from "./final-cta";
import { HowItWorks } from "./how-it-works";
import { LandingHeader } from "./landing-header";
import { LandingHero } from "./landing-hero";
import { ProductPreview } from "./product-preview";

export function LandingPage() {
  return (
    <div className="min-h-screen scroll-smooth bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <div className="pointer-events-none fixed inset-0 app-atmosphere" />

      <div className="relative">
        <LandingHeader />
        <main>
          <LandingHero />
          <FeatureCards />
          <HowItWorks />
          <ProductPreview />
          <FinalCta />
        </main>

        <footer className="border-t border-[var(--color-border-subtle)] px-6 py-8 text-center text-xs text-[var(--color-text-secondary)] lg:px-8">
          CareerOS — career intelligence workspace
        </footer>
      </div>
    </div>
  );
}

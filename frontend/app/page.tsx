import HeroSection from "@/features/home/components/HeroSection";
import FeaturedTournamentsSection from "@/features/home/components/FeaturedTournamentsSection";
import PlatformBenefitsSection from "@/features/home/components/PlatformBenefitsSection";
import TournamentFormatsSection from "@/features/home/components/TournamentFormatsSection";
import TournamentOperationSection from "@/features/home/components/TournamentOperationSection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <div className="home-sections">
        <FeaturedTournamentsSection />
        <TournamentOperationSection />
        <TournamentFormatsSection />
        <PlatformBenefitsSection />
      </div>
    </>
  );
}

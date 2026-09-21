import Hero from "@/components/home/Hero";
import TrustBar from "@/components/home/TrustBar";
import ServiceCards from "@/components/home/ServiceCards";
import WhereSupportHappens from "@/components/home/WhereSupportHappens";
import WhyMO from "@/components/home/WhyMO";
import GettingStartedTimeline from "@/components/home/GettingStartedTimeline";
import InsuranceSection from "@/components/home/InsuranceSection";
import FamilySection from "@/components/home/FamilySection";
import ReferringProfessionals from "@/components/home/ReferringProfessionals";
import ServiceAreaSection from "@/components/home/ServiceAreaSection";
import FAQAccordion from "@/components/home/FAQAccordion";
import FinalCTA from "@/components/home/FinalCTA";

// Homepage section order follows the client's explicit spec:
// Header (in layout) -> Hero -> Trust bar -> Services -> Where support
// happens -> Why MO -> Getting-started timeline -> Insurance -> Family ->
// Referring professionals -> Service area -> FAQ -> Final CTA -> Footer.
export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <ServiceCards />
      <WhereSupportHappens />
      <WhyMO />
      <GettingStartedTimeline />
      <InsuranceSection />
      <FamilySection />
      <ReferringProfessionals />
      <ServiceAreaSection />
      <FAQAccordion limit={8} />
      <FinalCTA />
    </>
  );
}


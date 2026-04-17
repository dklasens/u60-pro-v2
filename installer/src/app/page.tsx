import { Hero } from "@/components/landing/Hero";
import { StatsBar } from "@/components/landing/StatsBar";
import { DeviceSpecs } from "@/components/landing/DeviceSpecs";
import { Features } from "@/components/landing/Features";
import { FeatureDetails } from "@/components/landing/FeatureDetails";
import { Comparison } from "@/components/landing/Comparison";
import { MobileApps } from "@/components/landing/MobileApps";
import { APIOverview } from "@/components/landing/APIOverview";
import { CTA } from "@/components/landing/CTA";

export default function Home() {
  return (
    <>
      <Hero />
      <StatsBar />
      <DeviceSpecs />
      <Features />
      <FeatureDetails />
      <Comparison />
      <MobileApps />
      <APIOverview />
      <CTA />
    </>
  );
}

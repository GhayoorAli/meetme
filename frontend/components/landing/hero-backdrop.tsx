"use client";

import dynamic from "next/dynamic";

const HeroStage = dynamic(
  () => import("@/components/landing/hero-stage").then((mod) => mod.HeroStage),
  { ssr: false },
);

export function HeroBackdrop() {
  return (
    <div className="hero-stage" aria-hidden>
      <HeroStage />
    </div>
  );
}

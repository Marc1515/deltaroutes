"use client";

import { useEffect, useRef, useState } from "react";
import { EXPERIENCES, type ExperienceCard } from "@/config/experiences";
import { BookingModal } from "@/features/booking/components/BookingModal";
import { ContactSection } from "./ContactSection";
import { AboutUsSection } from "./AboutUsSection";
import { HomeSection } from "./HomeSection";
import { ExperiencesSection } from "./ExperiencesSection";
import { Banner1 } from "./Banner1";
import { Banner2 } from "./Banner2";

export function HomeClient() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ExperienceCard | null>(null);

  const firstPanelRef = useRef<HTMLDivElement | null>(null);
  const secondPanelRef = useRef<HTMLDivElement | null>(null);
  const contactTriggerRef = useRef<HTMLDivElement | null>(null);

  const [isIntroVisible, setIsIntroVisible] = useState(false);
  const [isSecondTextVisible, setIsSecondTextVisible] = useState(false);

  useEffect(() => {
    const firstPanel = firstPanelRef.current;
    const secondPanel = secondPanelRef.current;
    const contactTrigger = contactTriggerRef.current;

    if (!firstPanel || !secondPanel || !contactTrigger) {
      return;
    }

    const handleScroll = () => {
      const firstPanelTop = firstPanel.offsetTop;
      const secondPanelTop = secondPanel.offsetTop;
      const currentScroll = window.scrollY;
      const earlyRevealOffset = window.innerHeight * 0.75;
      const earlyHideOffset = window.innerHeight * 0.35;
      const secondPanelRect = secondPanel.getBoundingClientRect();
      const contactTriggerRect = contactTrigger.getBoundingClientRect();
      const secondTextRevealOffset = window.innerHeight * 0.75;
      const secondTextHideOffset = window.innerHeight * 0.35;

      // Visible un poco antes de que aboutUs3 ocupe completamente el viewport
      // y desaparece un poco antes de llegar al panel de aboutUs2.
      setIsIntroVisible(
        currentScroll >= firstPanelTop - earlyRevealOffset &&
          currentScroll < secondPanelTop - earlyHideOffset,
      );

      // El texto aparece un poco antes de que el segundo panel toque arriba
      // y desaparece un poco antes de que Contact entre en el viewport.
      setIsSecondTextVisible(
        secondPanelRect.top <= secondTextRevealOffset &&
          secondPanelRect.bottom > 0 &&
          contactTriggerRect.top > secondTextHideOffset,
      );
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main>
      <HomeSection />

      <ExperiencesSection
        experiences={EXPERIENCES}
        onSelect={(exp) => {
          setSelected(exp);
          setOpen(true);
        }}
      />

      <section
        className="min-h-screen w-full bg-black"
        aria-label="Sobre DeltaRoutes"
      >
        <Banner1 panelRef={firstPanelRef} isIntroVisible={isIntroVisible} />
        <AboutUsSection />
        <Banner2
          panelRef={secondPanelRef}
          isSecondTextVisible={isSecondTextVisible}
        />
        <div ref={contactTriggerRef}>
          <ContactSection />
        </div>
      </section>

      <BookingModal
        open={open}
        experience={selected}
        onClose={() => setOpen(false)}
      />
    </main>
  );
}

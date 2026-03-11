"use client";

import { useState } from "react";
import { EXPERIENCES, type ExperienceCard } from "@/config/experiences";
import { BookingModal } from "@/features/booking/components/BookingModal";
import { HomeSection } from "./HomeSection";
import { ExperiencesSection } from "./ExperiencesSection";
import { AboutUsSection } from "./AboutUsSection";

export function HomeClient() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ExperienceCard | null>(null);

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

      <AboutUsSection />

      <BookingModal
        open={open}
        experience={selected}
        onClose={() => setOpen(false)}
      />
    </main>
  );
}

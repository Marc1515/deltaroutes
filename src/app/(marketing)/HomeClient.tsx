"use client";

import { useState } from "react";
import { EXPERIENCES, type ExperienceCard } from "@/config/experiences";
import { ExperienceGrid } from "@/features/booking/components/ExperienceGrid";
import { BookingModal } from "@/features/booking/components/BookingModal";

export function HomeClient() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ExperienceCard | null>(null);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold">DeltaRoutes</h1>
      <p className="mt-2 opacity-80">Elige una experiencia para reservar.</p>

      <div className="mt-8">
        <ExperienceGrid
          experiences={EXPERIENCES}
          onSelect={(exp) => {
            setSelected(exp);
            setOpen(true);
          }}
        />
      </div>

      {/* Aquí luego pones secciones: Qué es, FAQ, contacto… */}

      <BookingModal
        open={open}
        experience={selected}
        onClose={() => setOpen(false)}
      />
    </main>
  );
}

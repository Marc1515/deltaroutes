"use client";

import Image from "next/image";
import type { ExperienceCard } from "@/config/experiences";

export function ExperienceGrid(props: {
  experiences: ExperienceCard[];
  onSelect: (exp: ExperienceCard) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {props.experiences.map((exp) => (
        <button
          key={exp.key}
          onClick={() => props.onSelect(exp)}
          className="relative h-48 w-full overflow-hidden rounded-2xl border text-left shadow-sm hover:shadow-md transition"
        >
          <Image
            src={exp.imageSrc}
            alt={exp.imageAlt}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 50vw"
            priority
          />

          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-black/0" />

          <div className="pointer-events-none absolute inset-0 flex items-end">
            <div className="p-4 text-white">
              <div className="text-lg font-semibold drop-shadow">
                {exp.title}
              </div>
              <div className="mt-1 text-sm opacity-90 drop-shadow">
                {exp.subtitle}
              </div>
              <div className="mt-3 inline-flex rounded-xl border border-white/70 bg-white/10 px-3 py-1 text-sm backdrop-blur-sm">
                Reservar
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

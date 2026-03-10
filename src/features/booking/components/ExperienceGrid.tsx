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
          className="rounded-2xl border text-left shadow-sm hover:shadow-md transition overflow-hidden"
        >
          <div className="relative h-40 w-full">
            <Image
              src={exp.imageSrc}
              alt={exp.imageAlt}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 50vw"
              priority
            />
          </div>

          <div className="p-6">
            <div className="text-lg font-semibold">{exp.title}</div>
            <div className="mt-1 text-sm opacity-80">{exp.subtitle}</div>
            <div className="mt-4 inline-flex rounded-xl border px-3 py-1 text-sm">
              Reservar
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

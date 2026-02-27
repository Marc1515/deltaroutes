"use client";

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
          className="rounded-2xl border p-6 text-left shadow-sm hover:shadow-md transition"
        >
          <div className="text-lg font-semibold">{exp.title}</div>
          <div className="mt-1 text-sm opacity-80">{exp.subtitle}</div>
          <div className="mt-4 inline-flex rounded-xl border px-3 py-1 text-sm">
            Reservar
          </div>
        </button>
      ))}
    </div>
  );
}

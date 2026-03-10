import type { ExperienceCard } from "@/config/experiences";
import { ExperienceGrid } from "@/features/booking/components/ExperienceGrid";

type ExperiencesSectionProps = {
  experiences: ExperienceCard[];
  onSelect: (exp: ExperienceCard) => void;
};

export function ExperiencesSection({
  experiences,
  onSelect,
}: ExperiencesSectionProps) {
  return (
    <section
      className="mx-auto max-w-5xl px-4 py-10"
      id="experiences"
      aria-label="Experiencias disponibles"
    >
      <h2 className="text-2xl font-semibold">Experiencias</h2>
      <p className="mt-2 opacity-80">
        Elige una de nuestras experiencias cuidadosamente diseñadas para
        descubrir el Delta desde una nueva perspectiva.
      </p>

      <div className="mt-8">
        <ExperienceGrid experiences={experiences} onSelect={onSelect} />
      </div>
    </section>
  );
}


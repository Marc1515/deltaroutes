"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ExperienceCard } from "@/config/experiences";

const MOBILE_BREAKPOINT = 639;
const MOBILE_MODAL_DELAY_MS = 450;

export function ExperienceGrid(props: {
  experiences: ExperienceCard[];
  onSelect: (exp: ExperienceCard) => void;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const openTimeoutRef = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = gridRef.current;

    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        setIsVisible(true);
        observer.disconnect();
      },
      { threshold: 0.15 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (openTimeoutRef.current !== null) {
        window.clearTimeout(openTimeoutRef.current);
      }
    };
  }, []);

  function handleSelect(exp: ExperienceCard, element: HTMLButtonElement | null) {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

    if (!isMobile || !element) {
      props.onSelect(exp);
      return;
    }

    if (openTimeoutRef.current !== null) {
      window.clearTimeout(openTimeoutRef.current);
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    openTimeoutRef.current = window.setTimeout(() => {
      props.onSelect(exp);
      openTimeoutRef.current = null;
    }, MOBILE_MODAL_DELAY_MS);
  }

  return (
    <div ref={gridRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {props.experiences.map((exp, index) => (
        <button
          key={exp.key}
          onClick={(event) => handleSelect(exp, event.currentTarget)}
          className="experience-card-reveal relative h-48 w-full overflow-hidden rounded-2xl border text-left shadow-sm transition hover:shadow-md"
          style={
            isVisible
              ? {
                  animation: `experience-card-reveal 950ms cubic-bezier(0.22, 1, 0.36, 1) ${
                    index * 180
                  }ms both`,
                }
              : undefined
          }
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

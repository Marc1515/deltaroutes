"use client";

import { useEffect, useRef, useState } from "react";
import { ContactSection } from "./ContactSection";

export function AboutUsSection() {
  const firstPanelRef = useRef<HTMLDivElement | null>(null);
  const secondPanelRef = useRef<HTMLDivElement | null>(null);
  const contactTriggerRef = useRef<HTMLDivElement | null>(null);
  const [isIntroVisible, setIsIntroVisible] = useState(false);
  const [isIntroOverlayVisible, setIsIntroOverlayVisible] = useState(false);
  const [isSecondTextVisible, setIsSecondTextVisible] = useState(false);
  const [isSecondOverlayVisible, setIsSecondOverlayVisible] = useState(false);

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
      const earlyRevealOffset = window.innerHeight * 0.15;
      const earlyHideOffset = window.innerHeight * 0.35;
      const secondPanelRect = secondPanel.getBoundingClientRect();
      const contactTriggerRect = contactTrigger.getBoundingClientRect();
      const secondTextRevealOffset = window.innerHeight * 0.15;
      const secondTextHideOffset = window.innerHeight * 0.35;

      // Visible un poco antes de que aboutUs3 ocupe completamente el viewport
      // y desaparece un poco antes de llegar al panel de aboutUs2.
      setIsIntroVisible(
        currentScroll >= firstPanelTop - earlyRevealOffset &&
          currentScroll < secondPanelTop - earlyHideOffset,
      );
      setIsIntroOverlayVisible(
        currentScroll >= firstPanelTop - earlyRevealOffset &&
          currentScroll < secondPanelTop,
      );

      // El texto aparece un poco antes de que el segundo panel toque arriba
      // y desaparece un poco antes de que Contact entre en el viewport.
      setIsSecondTextVisible(
        secondPanelRect.top <= secondTextRevealOffset &&
          secondPanelRect.bottom > 0 &&
          contactTriggerRect.top > secondTextHideOffset,
      );
      setIsSecondOverlayVisible(
        secondPanelRect.top <= secondTextRevealOffset &&
          secondPanelRect.bottom > 0,
      );
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      className="min-h-screen w-full bg-black"
      aria-label="Sobre DeltaRoutes"
    >
      <div
        ref={firstPanelRef}
        id="about-us"
        className="relative min-h-screen w-full bg-cover bg-center bg-no-repeat py-10 text-white md:bg-fixed"
        style={{ backgroundImage: 'url("/img/aboutUs7.png")' }}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-black/80 transition-opacity duration-500"
          style={{ opacity: isIntroOverlayVisible ? 1 : 0 }}
        />
        <div className="sticky top-10 z-10 mx-auto w-full max-w-5xl px-4">
          <h2
            className="mb-8 text-2xl font-semibold transition-opacity duration-500"
            style={{
              opacity: isIntroVisible ? 1 : 0,
              transitionDelay: isIntroVisible ? "120ms" : "0ms",
            }}
          >
            Sobre nosotros
          </h2>
          <p
            className="transition-all duration-500"
            style={{
              opacity: isIntroVisible ? 1 : 0,
              transform: isIntroVisible ? "translateY(0)" : "translateY(24px)",
              transitionDelay: isIntroVisible ? "260ms" : "0ms",
            }}
          >
            En DeltaRoutes somos un pequeño equipo enamorado de este territorio
            y de todo lo que puede ofrecer a quienes lo visitan. Trabajamos
            junto a guías locales y proyectos sostenibles para crear
            experiencias auténticas, respetuosas con el entorno y alejadas del
            turismo masivo.
          </p>
          <p
            className="mt-4 transition-all duration-500"
            style={{
              opacity: isIntroVisible ? 1 : 0,
              transform: isIntroVisible ? "translateY(0)" : "translateY(24px)",
              transitionDelay: isIntroVisible ? "420ms" : "0ms",
            }}
          >
            Creemos que descubrir un lugar no consiste solo en verlo, sino en
            vivirlo con tiempo, entender su esencia y conectar con su paisaje,
            su cultura y las personas que forman parte de él. Por eso cuidamos
            cada actividad para que resulte cercana, cómoda y especial desde el
            primer momento.
          </p>
        </div>
      </div>
      <div
        ref={secondPanelRef}
        className="sticky top-0 z-0 min-h-screen w-full bg-cover bg-center bg-no-repeat py-10 text-white"
        style={{
          backgroundImage: 'url("/img/aboutUs5.jpeg")',
          backgroundPosition: "44.5% center",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-black/80 transition-opacity duration-500"
          style={{ opacity: isSecondOverlayVisible ? 1 : 0 }}
        />
        <div className="sticky top-0 z-10 mx-auto w-full max-w-5xl px-4">
          <p
            className="sticky top-10 mt-3 transition-all duration-500"
            style={{
              opacity: isSecondTextVisible ? 1 : 0,
              transform: isSecondTextVisible
                ? "translateY(0)"
                : "translateY(24px)",
              transitionDelay: isSecondTextVisible ? "220ms" : "0ms",
            }}
          >
            Nuestra propuesta reúne distintas formas de explorar la zona, ya sea
            a pie, en bicicleta, en kayak o disfrutando de una salida más
            relajada en mini-crucero. Queremos que cada persona pueda encontrar
            una experiencia que encaje con su ritmo, sus intereses y su manera
            de viajar.
          </p>
          <p
            className="mt-4 transition-all duration-500"
            style={{
              opacity: isSecondTextVisible ? 1 : 0,
              transform: isSecondTextVisible
                ? "translateY(0)"
                : "translateY(24px)",
              transitionDelay: isSecondTextVisible ? "380ms" : "0ms",
            }}
          >
            Además, apostamos por una forma de reserva sencilla y clara, para
            que organizar tu actividad sea tan fácil como disfrutarla. Nuestro
            objetivo es que descubras el territorio como lo viven quienes lo
            habitan: con calma, cercanía y un profundo respeto por la
            naturaleza.
          </p>
        </div>
      </div>
      <div ref={contactTriggerRef}>
        <ContactSection />
      </div>
    </section>
  );
}

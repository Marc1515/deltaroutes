"use client";

import { RefObject } from "react";

export function Banner1({
  panelRef,
  isIntroVisible,
  isIntroOverlayVisible,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  isIntroVisible: boolean;
  isIntroOverlayVisible: boolean;
}) {
  return (
    <div
      ref={panelRef}
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
          En DeltaRoutes somos un pequeño equipo enamorado de este territorio y
          de todo lo que puede ofrecer a quienes lo visitan. Trabajamos junto a
          guías locales y proyectos sostenibles para crear experiencias
          auténticas, respetuosas con el entorno y alejadas del turismo masivo.
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
          vivirlo con tiempo, entender su esencia y conectar con su paisaje, su
          cultura y las personas que forman parte de él. Por eso cuidamos cada
          actividad para que resulte cercana, cómoda y especial desde el primer
          momento.
        </p>
      </div>
    </div>
  );
}

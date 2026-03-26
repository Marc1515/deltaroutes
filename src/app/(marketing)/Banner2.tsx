"use client";

import { RefObject } from "react";

export function Banner2({
  panelRef,
  isSecondOverlayVisible,
  isSecondTextVisible,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  isSecondOverlayVisible: boolean;
  isSecondTextVisible: boolean;
}) {
  return (
    <div
      ref={panelRef}
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
          una experiencia que encaje con su ritmo, sus intereses y su manera de
          viajar.
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
          habitan: con calma, cercanía y un profundo respeto por la naturaleza.
        </p>
      </div>
    </div>
  );
}


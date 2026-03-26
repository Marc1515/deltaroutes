"use client";

import { useEffect, useState } from "react";

export function HomeSection() {
  const [homeTitleOpacity, setHomeTitleOpacity] = useState(1);
  const [titleFirstParagraphOpacity, setTitleFirstParagraphOpacity] =
    useState(0);
  const [secondParagraphOpacity, setSecondParagraphOpacity] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      const vh = window.innerHeight || 1;
      const s = y / vh; // progreso de scroll en múltiplos de la altura de la ventana (0 = top, 1 = 100vh)
      let homeTitleOpacity = 1;

      // Título principal ("DeltaRoutes" de arriba)
      // 0–0.2vh: visible
      // 0.2–0.25vh: fade out
      // ≥0.25vh: oculto
      if (s <= 0.2) {
        homeTitleOpacity = 1;
      } else if (s >= 0.25) {
        homeTitleOpacity = 0;
      } else {
        const progress = (s - 0.2) / 0.05; // 0.2–0.25
        homeTitleOpacity = 1 - progress;
      }

      setHomeTitleOpacity(homeTitleOpacity);

      // Control del primer párrafo:
      // 0–0.25vh: oculto
      // 0.25–0.3vh: aparece (0 → 1)
      // 0.3–0.55vh: visible
      // 0.55–0.6vh: desaparece (1 → 0)
      // ≥0.6vh: oculto
      let nextTitleOpacity = 0;

      if (s < 0.25) {
        nextTitleOpacity = 0;
      } else if (s <= 0.3) {
        const fadeInProgress = (s - 0.25) / 0.05; // 0.25–0.3
        nextTitleOpacity = Math.min(1, Math.max(0, fadeInProgress));
      } else if (s < 0.55) {
        nextTitleOpacity = 1;
      } else if (s <= 0.6) {
        const fadeOutProgress = (s - 0.55) / 0.05; // 0.55–0.6
        nextTitleOpacity = 1 - Math.min(1, Math.max(0, fadeOutProgress));
      } else {
        nextTitleOpacity = 0;
      }

      setTitleFirstParagraphOpacity(nextTitleOpacity);

      // Segundo párrafo:
      // 0–0.6vh: oculto
      // 0.6–0.65vh: aparece (0 → 1)
      // 0.65–0.85vh: visible
      // 0.85–0.9vh: desaparece (1 → 0)
      // ≥0.9vh: oculto
      let nextSecondOpacity = 0;

      if (s < 0.6) {
        nextSecondOpacity = 0;
      } else if (s <= 0.65) {
        const fadeInProgress = (s - 0.6) / 0.05; // 0.6–0.65
        nextSecondOpacity = Math.min(1, Math.max(0, fadeInProgress));
      } else if (s < 0.85) {
        nextSecondOpacity = 1;
      } else if (s <= 0.9) {
        const fadeOutProgress = (s - 0.85) / 0.05; // 0.85–0.9
        nextSecondOpacity = 1 - Math.min(1, Math.max(0, fadeOutProgress));
      } else {
        nextSecondOpacity = 0;
      }

      setSecondParagraphOpacity(nextSecondOpacity);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      id="home"
      className="min-h-screen w-full bg-cover bg-center bg-fixed bg-no-repeat"
      style={{ backgroundImage: 'url("/img/home.png")' }}
      aria-label="Inicio"
    >
      <div className="flex min-h-screen w-full flex-col justify-between px-4 pt-20 pb-10 text-center">
        <h1
          className="sticky top-20 text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-semibold text-white drop-shadow transition-opacity duration-300"
          style={{ opacity: homeTitleOpacity }}
        >
          DeltaRoutes
        </h1>
        <p
          className="sticky top-15 mt-2 text-lg md:text-xl lg:text-2xl xl:text-3xl text-white drop-shadow transition-opacity duration-100"
          style={{ opacity: titleFirstParagraphOpacity }}
        >
          Explora rutas únicas por el Delta del Ebro y reserva experiencias
          inolvidables
        </p>

        <p
          className="sticky top-15 opacity-90 text-lg md:text-xl lg:text-2xl xl:text-3xl text-white drop-shadow transition-opacity duration-300"
          style={{ opacity: secondParagraphOpacity }}
        >
          Crea recuerdos inolvidables explorando los rincones más especiales
        </p>

        <div className="h-32" />
      </div>
    </section>
  );
}

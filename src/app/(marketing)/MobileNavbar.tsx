"use client";

import { useState } from "react";

const SECTIONS = [
  { id: "top", label: "Inicio" },
  { id: "experiences", label: "Experiencias" },
  { id: "about-us", label: "Sobre nosotros" },
  { id: "contact", label: "Contacto" },
];

export function MobileNavbar() {
  const [open, setOpen] = useState(false);

  const handleNavigate = (id: string) => {
    setOpen(false);

    if (id === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menú de navegación"
        className="fixed right-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white/80 shadow-md backdrop-blur md:hidden"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="sr-only">Abrir menú</span>
        <span className="relative block h-4 w-4">
          <span
            className={`absolute left-0 h-0.5 w-full bg-black transition-transform ${
              open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"
            }`}
          />
          <span
            className={`absolute left-0 h-0.5 w-full bg-black transition-opacity ${
              open ? "top-1/2 opacity-0" : "top-1/2 -translate-y-1/2"
            }`}
          />
          <span
            className={`absolute left-0 h-0.5 w-full bg-black transition-transform ${
              open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0"
            }`}
          />
        </span>
      </button>

      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <nav
          className={`absolute right-0 top-0 h-full w-64 bg-white text-black px-6 py-10 shadow-xl transition-transform duration-200 ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="mb-8 flex items-center justify-between">
            <span className="text-lg font-semibold">DeltaRoutes</span>
          </div>

          <ul className="space-y-4 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  className="w-full text-left font-medium tracking-wide"
                  onClick={() => handleNavigate(section.id)}
                >
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}

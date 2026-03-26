"use client";

export function AboutUsSection() {
  return (
    <section
      className="min-h-screen w-full bg-black text-white md:flex md:flex-col md:justify-center"
      aria-label="Sobre DeltaRoutes - nuestra forma de viajar"
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-14 md:py-20">
        <h2 className="text-2xl font-semibold md:text-3xl">
          Experiencias con calma y respeto
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80 md:text-base">
          Nos mueve cuidar el territorio como lo haría quien lo habita. Por eso
          diseñamos planes cercanos, sostenibles y adaptados a tu forma de
          viajar, evitando el turismo masivo y poniendo en valor la naturaleza
          del Delta del Ebro.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h3 className="font-medium">Guías locales</h3>
            <p className="mt-2 text-sm text-white/75">
              Experiencias contadas desde dentro, con conocimiento y cercanía.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h3 className="font-medium">Sostenibilidad</h3>
            <p className="mt-2 text-sm text-white/75">
              Priorizamos prácticas respetuosas para disfrutar sin impactar.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h3 className="font-medium">A tu ritmo</h3>
            <p className="mt-2 text-sm text-white/75">
              Un plan pensado para encajar con tu energía, tus intereses y tu
              tiempo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

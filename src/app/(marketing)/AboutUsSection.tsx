export function AboutUsSection() {
  return (
    <section
      className="min-h-screen w-full"
      id="about-us"
      aria-label="Sobre DeltaRoutes"
    >
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-2xl font-semibold">Sobre nosotros</h2>
        <p className="mt-4 opacity-80">
          En DeltaRoutes somos un pequeño equipo enamorado del Delta del Ebro.
          Colaboramos con guías locales y proyectos sostenibles para ofrecer
          experiencias auténticas, respetuosas con el entorno y alejadas del
          turismo masivo.
        </p>
        <p className="mt-3 opacity-80">
          Nuestro objetivo es que descubras el territorio como lo viven las
          personas que lo habitan: con calma, cercanía y cuidado por la
          naturaleza.
        </p>
      </div>
    </section>
  );
}

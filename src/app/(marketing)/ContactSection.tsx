export function ContactSection() {
  return (
    <section
      className="mx-auto max-w-5xl px-4 py-10"
      id="contact"
      aria-label="Contacto"
    >
      <h2 className="text-2xl font-semibold">Contacto</h2>
      <p className="mt-4 opacity-80">
        ¿Tienes dudas sobre alguna experiencia, necesitas una propuesta a
        medida o viajas en grupo? Escríbenos y te ayudamos.
      </p>

      <div className="mt-6 space-y-2 text-sm opacity-90">
        <p>
          <span className="font-medium">Email:</span>{" "}
          <a
            href="mailto:hola@deltaroutes.com"
            className="underline underline-offset-4"
          >
            hola@deltaroutes.com
          </a>
        </p>
        <p>
          <span className="font-medium">Teléfono:</span> +34 600 000 000
        </p>
      </div>
    </section>
  );
}


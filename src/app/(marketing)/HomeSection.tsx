export function HomeSection() {
  return (
    <section
      id="home"
      className="min-h-screen w-full flex items-center bg-cover bg-center bg-fixed"
      style={{ backgroundImage: 'url("/img/home.jpg")' }}
      aria-label="Inicio"
    >
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-semibold text-white drop-shadow">
          DeltaRoutes
        </h1>
        <p className="mt-2 opacity-90 text-white drop-shadow">
          Explora rutas únicas por el Delta del Ebro y reserva experiencias
          inolvidables.
        </p>
      </div>
    </section>
  );
}

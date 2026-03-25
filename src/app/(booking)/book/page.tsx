import { Suspense } from "react";
import BookPageClient from "@/app/(booking)/book/BookPageClient";

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <main className="p-6 max-w-xl">
          <h1 className="text-2xl font-semibold">Reserva</h1>
          <p className="mt-2 text-gray-600">Cargando…</p>
        </main>
      }
    >
      <BookPageClient />
    </Suspense>
  );
}

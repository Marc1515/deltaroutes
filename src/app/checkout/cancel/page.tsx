import { Suspense } from "react";
import CancelPageClient from "@/app/checkout/cancel/CancelPageClient";

export default function CancelPage() {
  return (
    <Suspense
      fallback={
        <main className="max-w-xl p-6">
          <h1 className="text-2xl font-semibold">Pago cancelado</h1>
          <p className="mt-2 text-gray-700">Cargando…</p>
        </main>
      }
    >
      <CancelPageClient />
    </Suspense>
  );
}

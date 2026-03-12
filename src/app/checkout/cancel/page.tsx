"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { releaseHoldReservation } from "@/features/booking/api/booking.api";

type UiState = "idle" | "releasing" | "released" | "already_released" | "error";

export default function CancelPage() {
  const searchParams = useSearchParams();
  const checkoutSessionId = searchParams.get("session_id");

  const [state, setState] = useState<UiState>(checkoutSessionId ? "releasing" : "idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!checkoutSessionId) return;

    let cancelled = false;

    const releaseHold = async () => {
      setState("releasing");
      setErrorMessage(null);

      try {
        const result = await releaseHoldReservation({ checkoutSessionId });

        if (cancelled) return;

        if (!result.ok) {
          setState("error");
          setErrorMessage(result.error || "No se pudo liberar la retencion");
          return;
        }

        setState(result.released ? "released" : "already_released");
      } catch (e) {
        if (cancelled) return;

        setState("error");
        setErrorMessage(e instanceof Error ? e.message : "Error desconocido");
      }
    };

    void releaseHold();

    return () => {
      cancelled = true;
    };
  }, [checkoutSessionId]);

  return (
    <main className="max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Pago cancelado</h1>
      <p className="mt-2 text-gray-700">No se ha realizado ningun cargo.</p>

      {checkoutSessionId ? (
        <div className="mt-4 space-y-2 text-sm text-gray-700">
          {state === "releasing" && (
            <p>Estamos liberando tu retencion para devolver las plazas al instante...</p>
          )}

          {state === "released" && (
            <p className="text-green-700">Tu retencion se ha liberado correctamente.</p>
          )}

          {state === "already_released" && (
            <p>La retencion ya no estaba activa cuando llegaste a esta pagina.</p>
          )}

          {state === "error" && (
            <p className="text-red-600">
              No pudimos liberar la retencion automaticamente. {errorMessage}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-600">
          Falta `session_id` en la URL, asi que no hemos podido localizar la reserva.
        </p>
      )}
    </main>
  );
}
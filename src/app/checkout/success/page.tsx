"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type OkFound = {
  ok: true;
  found: true;
  reservationId: string;
  reservationStatus: string;
  paymentStatus: string;
};

type NotFoundYet = {
  ok: false;
  found: false;
  message: string;
};

type ApiError = {
  error: string;
};

type StatusResponse = OkFound | NotFoundYet | ApiError;

function isOkFound(x: StatusResponse): x is OkFound {
  return "ok" in x && x.ok === true && "found" in x && x.found === true;
}

type UiState = "loading" | "confirmed" | "not_found" | "error";

export default function SuccessPage() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id"); // ✅ aquí sí lo pillas siempre

  const [state, setState] = useState<UiState>("loading");
  const [data, setData] = useState<StatusResponse | null>(null);

  const endpoint = useMemo(() => {
    if (!sessionId) return null;
    return `/api/payments/status?session_id=${encodeURIComponent(sessionId)}`;
  }, [sessionId]);

  useEffect(() => {
    if (!endpoint) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        const json = (await res.json()) as StatusResponse;

        if (cancelled) return;

        setData(json);

        if (res.status === 404) {
          setState("not_found");
          timer = setTimeout(poll, 1500);
          return;
        }

        if (!res.ok) {
          setState("error");
          return;
        }

        if (isOkFound(json)) {
          const confirmed =
            json.paymentStatus === "SUCCEEDED" &&
            json.reservationStatus === "CONFIRMED";

          if (confirmed) {
            setState("confirmed");
            return;
          }

          setState("loading");
          timer = setTimeout(poll, 1500);
          return;
        }

        setState("error");
      } catch {
        if (!cancelled) setState("error");
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [endpoint]);

  if (!sessionId) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Pago completado</h1>
        <p className="mt-2 text-red-600">Falta session_id en la URL.</p>
        <p className="mt-2 text-xs text-gray-400 break-all">
          URL actual: {typeof window !== "undefined" ? window.location.href : ""}
        </p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-xl">
      <h1 className="text-2xl font-semibold">✅ Pago completado</h1>

      {state === "confirmed" ? (
        <div className="mt-4">
          <p className="text-green-700">Tu reserva ya está confirmada.</p>
          {"reservationId" in (data ?? {}) && (
            <p className="mt-2 text-sm text-gray-600">
              ID de reserva: {(data as OkFound).reservationId}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-gray-700">
            Estamos confirmando tu reserva… (puede tardar unos segundos)
          </p>

          {state === "not_found" && (
            <p className="mt-2 text-sm text-gray-500">
              Aún no está en la base de datos. Reintentando…
            </p>
          )}

          {state === "error" && (
            <p className="mt-2 text-sm text-red-600">
              Ha ocurrido un error confirmando el pago. Refresca la página.
            </p>
          )}

          <p className="mt-3 text-xs text-gray-400 break-all">
            session_id: {sessionId}
          </p>
        </div>
      )}
    </main>
  );
}

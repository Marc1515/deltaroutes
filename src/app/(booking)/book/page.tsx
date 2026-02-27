"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type WaitingInfo =
  | {
      ok: true;
      waitingId: string;
      sessionId: string;
      experienceTitle: string;
      startAt: string; // ISO
      bookingClosesAt: string; // ISO
      adultsCount: number;
      minorsCount: number;
      totalPax: number;
      customerEmail: string;
      customerName: string | null;
      canClaimNow: boolean;
      freeSeats: number;
      maxSeatsTotal: number;
      isCancelled: boolean;
    }
  | { ok: false; error: string };

type ClaimResponse =
  | { ok: true; reservationId: string; holdExpiresAt: string }
  | {
      ok: false;
      error: string;
      code?: "NO_SEATS" | "NOT_WAITING" | "CLOSED" | "CANCELLED";
    };

type UpdateHoldResponse = { ok: true } | { ok: false; error: string };

type CheckoutResponse =
  | { ok: true; checkoutUrl: string; reused?: boolean }
  | { ok?: false; error: string };

type ResubscribeResponse = { ok: true } | { ok: false; error: string };

function safePreview(text: string, max = 180) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

export default function BookPage() {
  const sp = useSearchParams();
  const waitingId = sp.get("waitingId");

  const [info, setInfo] = useState<WaitingInfo | null>(null);
  const [step, setStep] = useState<"pre" | "details">("pre");
  const [reservationId, setReservationId] = useState<string | null>(null);

  const [loadingClaim, setLoadingClaim] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);

  const [showUps, setShowUps] = useState(false);
  const [loadingResubscribe, setLoadingResubscribe] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tourLanguage, setTourLanguage] = useState<"CA" | "ES" | "EN">("ES");

  const endpoint = useMemo(() => {
    if (!waitingId) return null;
    return `/api/reservations/waiting/${encodeURIComponent(waitingId)}`;
  }, [waitingId]);

  // reset al cambiar waitingId
  useEffect(() => {
    setInfo(null);
    setStep("pre");
    setReservationId(null);
    setShowUps(false);
  }, [waitingId]);

  async function loadWaitingInfo() {
    if (!endpoint) return;

    const res = await fetch(endpoint, { cache: "no-store" });
    const raw = await res.text();

    let json: WaitingInfo;
    try {
      json = JSON.parse(raw) as WaitingInfo;
    } catch {
      setInfo({
        ok: false,
        error: `Respuesta no-JSON (${res.status}). Preview: ${safePreview(raw)}`,
      });
      return;
    }

    setInfo(json);

    if (json.ok) {
      setCustomerName(json.customerName ?? "");

      // ✅ Si al abrir el link NO hay plazas suficientes, mostramos directamente el “Ups…”
      if (!json.canClaimNow) {
        setShowUps(true);
      } else {
        setShowUps(false);
      }
    }
  }

  useEffect(() => {
    if (!endpoint) return;

    let cancelled = false;
    (async () => {
      try {
        await loadWaitingInfo();
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof Error ? e.message : "Error desconocido cargando datos";
        setInfo({ ok: false, error: msg });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function onClaim() {
    if (!waitingId) return;
    if (!info || !info.ok) return;

    setLoadingClaim(true);
    try {
      const res = await fetch("/api/reservations/waiting/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ waitingId }),
      });

      const raw = await res.text();
      let json: ClaimResponse;

      try {
        json = JSON.parse(raw) as ClaimResponse;
      } catch {
        alert(
          `Respuesta no-JSON al reclamar (${res.status}). Preview: ${safePreview(raw)}`,
        );
        return;
      }

      if (!res.ok || !json.ok) {
        // ✅ Si pierde la carrera -> Ups + opción re-avisar
        if (!json.ok && json.code === "NO_SEATS") {
          setShowUps(true);
          await loadWaitingInfo();
          return;
        }

        const msg = json.ok
          ? "No se ha podido reclamar."
          : json.code === "CLOSED"
            ? "Las reservas para esta sesión ya están cerradas."
            : json.code === "CANCELLED"
              ? "Esta sesión está cancelada."
              : json.code === "NOT_WAITING"
                ? "Esta reserva ya no está en lista de espera."
                : json.error;

        alert(msg);
        return;
      }

      setReservationId(json.reservationId);
      setStep("details");
      setShowUps(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error reclamando plazas";
      alert(msg);
    } finally {
      setLoadingClaim(false);
    }
  }

  async function onResubscribe() {
    if (!waitingId) return;

    setLoadingResubscribe(true);
    try {
      const res = await fetch("/api/reservations/waiting/resubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ waitingId }),
      });

      const raw = await res.text();
      let json: ResubscribeResponse;

      try {
        json = JSON.parse(raw) as ResubscribeResponse;
      } catch {
        alert(
          `Respuesta no-JSON al reactivar aviso (${res.status}). Preview: ${safePreview(
            raw,
          )}`,
        );
        return;
      }

      if (!res.ok || !json.ok) {
        alert(json.ok ? "Error" : json.error);
        return;
      }

      // ✅ El usuario ya ha dicho “avísame de nuevo”.
      // Dejamos el mensaje para que no intente claimar ahora mismo.
      alert("Perfecto. Te avisaremos de nuevo si se liberan plazas.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error reactivando aviso";
      alert(msg);
    } finally {
      setLoadingResubscribe(false);
    }
  }

  async function onComplete() {
    if (!reservationId) return;

    if (!customerName.trim()) {
      alert("Escribe tu nombre");
      return;
    }

    setLoadingComplete(true);
    try {
      const res = await fetch("/api/reservations/hold/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          reservationId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || null,
          tourLanguage,
        }),
      });

      const raw = await res.text();
      let json: UpdateHoldResponse;

      try {
        json = JSON.parse(raw) as UpdateHoldResponse;
      } catch {
        alert(
          `Respuesta no-JSON al completar (${res.status}). Preview: ${safePreview(raw)}`,
        );
        return;
      }

      if (!res.ok || !json.ok) {
        alert(json.ok ? "Error" : json.error);
        return;
      }

      const payRes = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ reservationId }),
      });

      const payRaw = await payRes.text();
      let payJson: CheckoutResponse;

      try {
        payJson = JSON.parse(payRaw) as CheckoutResponse;
      } catch {
        alert(
          `Respuesta no-JSON al iniciar pago (${payRes.status}). Preview: ${safePreview(
            payRaw,
          )}`,
        );
        return;
      }

      if (
        !payRes.ok ||
        !payJson.ok ||
        !("checkoutUrl" in payJson) ||
        !payJson.checkoutUrl
      ) {
        alert(
          "error" in payJson && payJson.error
            ? payJson.error
            : "No se pudo iniciar el pago.",
        );
        return;
      }

      window.location.href = payJson.checkoutUrl;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error completando reserva";
      alert(msg);
    } finally {
      setLoadingComplete(false);
    }
  }

  if (!waitingId) {
    return (
      <main className="p-6 max-w-xl">
        <h1 className="text-2xl font-semibold">Reserva</h1>
        <p className="mt-2 text-red-600">Falta waitingId en la URL.</p>
      </main>
    );
  }

  if (!info) {
    return (
      <main className="p-6 max-w-xl">
        <h1 className="text-2xl font-semibold">Reserva</h1>
        <p className="mt-2 text-gray-600">Cargando…</p>
      </main>
    );
  }

  if (!info.ok) {
    return (
      <main className="p-6 max-w-xl">
        <h1 className="text-2xl font-semibold">Reserva</h1>
        <p className="mt-2 text-red-600">{info.error}</p>
      </main>
    );
  }

  const startText = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(info.startAt));

  return (
    <main className="p-6 max-w-xl">
      <h1 className="text-2xl font-semibold">DeltaRoutes · Reservar</h1>

      <div className="mt-4 rounded-xl border p-4">
        <p className="font-medium">{info.experienceTitle}</p>
        <p className="text-sm text-gray-600 mt-1">Fecha: {startText}</p>
        <p className="text-sm text-gray-600 mt-1">
          Grupo: {info.adultsCount} adulto(s) y {info.minorsCount} menor(es) (
          {info.totalPax} en total)
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Plazas libres ahora: {info.freeSeats} / {info.maxSeatsTotal}
        </p>
      </div>

      {/* ✅ Si no hay plazas, mostramos directamente el “Ups…” */}
      {showUps ? (
        <div className="mt-6 rounded-xl border p-4">
          <p className="font-medium">Ups… alguien se te ha adelantado.</p>
          <p className="mt-2 text-sm text-gray-600">
            Ahora mismo no quedan plazas suficientes para tu grupo. ¿Quieres que
            te volvamos a avisar si se liberan plazas?
          </p>

          <button
            disabled={loadingResubscribe}
            onClick={onResubscribe}
            className="mt-4 w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loadingResubscribe ? "Activando aviso…" : "Avísame de nuevo"}
          </button>

          <button
            onClick={() => setShowUps(false)}
            className="mt-2 w-full rounded-md border px-4 py-2"
          >
            No, gracias
          </button>
        </div>
      ) : step === "pre" ? (
        <div className="mt-6">
          <button
            disabled={loadingClaim || !info.canClaimNow}
            onClick={onClaim}
            className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loadingClaim ? "Comprobando…" : "Reservar ahora"}
          </button>

          {!info.canClaimNow && (
            <p className="mt-3 text-sm text-red-600">
              Ahora mismo no hay plazas suficientes para tu grupo (o la sesión
              está cerrada).
            </p>
          )}

          <p className="mt-2 text-xs text-gray-500">
            Al pulsar “Reservar ahora” intentaremos bloquear plazas para tu
            grupo (HOLD). Si alguien se adelanta, te avisaremos.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="text-sm text-gray-700">Nombre</span>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Tu nombre"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700">Teléfono (opcional)</span>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+34..."
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700">Idioma del tour</span>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={tourLanguage}
              onChange={(e) =>
                setTourLanguage(e.target.value as "CA" | "ES" | "EN")
              }
            >
              <option value="CA">Català</option>
              <option value="ES">Español</option>
              <option value="EN">English</option>
            </select>
          </label>

          <button
            disabled={loadingComplete}
            onClick={onComplete}
            className="mt-2 w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loadingComplete ? "Preparando pago…" : "Completar reserva"}
          </button>

          <p className="text-xs text-gray-500">
            Ya tienes un HOLD temporal. Si no completas el pago a tiempo, se
            liberarán las plazas.
          </p>
        </div>
      )}
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

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
  | { ok: false; error: string };

export default function BookPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const waitingId = sp.get("waitingId");

  const [info, setInfo] = useState<WaitingInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tourLanguage, setTourLanguage] = useState<"CA" | "ES" | "EN">("ES");

  const endpoint = useMemo(() => {
    if (!waitingId) return null;
    return `/api/reservations/waiting/${encodeURIComponent(waitingId)}`;
  }, [waitingId]);

  useEffect(() => {
    if (!endpoint) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        const json = (await res.json()) as WaitingInfo;
        if (cancelled) return;

        setInfo(json);

        if (json.ok) {
          setCustomerName(json.customerName ?? "");
        }
      } catch (e) {
        if (!cancelled)
          setInfo({ ok: false, error: "Failed to load waiting info" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  async function onClaim() {
    if (!waitingId) return;
    if (!customerName.trim()) {
      alert("Escribe tu nombre");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reservations/waiting/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          waitingId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || null,
          tourLanguage,
        }),
      });

      const json = (await res.json()) as ClaimResponse;

      if (!res.ok || !json.ok) {
        alert(json.ok ? "Error" : json.error);
        setLoading(false);
        return;
      }

      // Ya tienes HOLD -> mandamos a tu flujo de pago (lo que ya usas)
      router.push(
        `/checkout/start?reservationId=${encodeURIComponent(json.reservationId)}`,
      );
    } catch {
      alert("Error reclamando plazas");
    } finally {
      setLoading(false);
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

        {!info.canClaimNow && (
          <p className="mt-3 text-sm text-red-600">
            Ahora mismo ya no hay plazas suficientes para tu grupo (o la sesión
            está cerrada). Inténtalo más tarde.
          </p>
        )}
      </div>

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
          disabled={loading || !info.canClaimNow}
          onClick={onClaim}
          className="mt-2 w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Reservando…" : "Reservar ahora"}
        </button>

        <p className="text-xs text-gray-500">
          Nota: al pulsar “Reservar ahora” se crea un HOLD temporal para tu
          grupo y podrás pagar en Stripe.
        </p>
      </div>
    </main>
  );
}

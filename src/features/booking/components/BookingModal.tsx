"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExperienceCard } from "@/config/experiences";
import type { SessionAvailability } from "../types/booking.types";
import { useSessions } from "../hooks/useSessions";
import {
  joinWaitlist,
  createHoldReservation,
  createCheckout,
  releaseHoldReservation,
  updateHoldReservation,
} from "../api/booking.api";
import type { LanguageBase } from "@/generated/prisma";

type Step = 1 | 2 | 3;
const MODAL_ANIMATION_MS = 220;

function formatDate(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function BookingModal(props: {
  open: boolean;
  experience: ExperienceCard | null;
  onClose: () => void;
}) {
  const { open, experience, onClose } = props;
  const [shouldRender, setShouldRender] = useState(open);
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [adults, setAdults] = useState(1);
  const [minors, setMinors] = useState(0);
  const [email, setEmail] = useState("");

  const pax = useMemo(() => adults + minors, [adults, minors]);
  const experienceId = experience?.experienceId;
  const isLiveRefreshingStep2 = shouldRender && step === 2;

  // Step 2
  const { loading, error, sessions, refreshSessions } = useSessions({
    experienceId,
    pax,
    autoRefreshEnabled: isLiveRefreshingStep2,
    refreshIntervalMs: 2000,
  });
  const [selectedSession, setSelectedSession] =
    useState<SessionAvailability | null>(null);

  // Step 3
  const [tourLanguage, setTourLanguage] = useState<LanguageBase>("ES");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [busy, setBusy] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeHoldId, setActiveHoldId] = useState<string | null>(null);

  const resetAll = useCallback(() => {
    setStep(1);
    setAdults(1);
    setMinors(0);
    setEmail("");
    setSelectedSession(null);
    setTourLanguage("ES");
    setFullName("");
    setPhone("");
    setBusy(false);
    setUiError(null);
    setSuccessMsg(null);
    setActiveHoldId(null);
  }, []);

  const releaseTrackedHold = useCallback(async (reservationId: string) => {
    const result = await releaseHoldReservation({ reservationId });

    if (result.ok) {
      setActiveHoldId(null);
      await refreshSessions();
    }

    return result;
  }, [refreshSessions]);

  const startHoldForSession = useCallback(
    async (session: SessionAvailability) => {
      setBusy(true);
      setUiError(null);
      setSuccessMsg(null);

      try {
        const hold = await createHoldReservation({
          sessionId: session.id,
          customerEmail: email.trim(),
          adultsCount: adults,
          minorsCount: minors,
        });

        if (!hold.ok) {
          setUiError(hold.error || "No se pudo bloquear la sesion");
          return;
        }

        if (hold.kind !== "HOLD") {
          setSuccessMsg(
            "Mientras elegias la sesion se agotaron las plazas y te hemos puesto en lista de espera.",
          );
          return;
        }

        setActiveHoldId(hold.reservationId);
        setSelectedSession(session);
        await refreshSessions();
        setStep(3);
      } catch (e) {
        setUiError(e instanceof Error ? e.message : "Error desconocido");
      } finally {
        setBusy(false);
      }
    },
    [adults, email, minors, refreshSessions],
  );

  const close = useCallback(async () => {
    if (busy) return;

    if (!activeHoldId) {
      onClose();
      return;
    }

    setBusy(true);
    setUiError(null);

    try {
      const released = await releaseTrackedHold(activeHoldId);

      if (!released.ok) {
        setUiError(released.error || "No se pudo liberar la reserva");
        return;
      }

      onClose();
    } finally {
      setBusy(false);
    }
  }, [activeHoldId, busy, onClose, releaseTrackedHold]);

  const goBackToSessions = useCallback(async () => {
    if (busy) return;

    if (!activeHoldId) {
      setStep(2);
      return;
    }

    setBusy(true);
    setUiError(null);

    try {
      const released = await releaseTrackedHold(activeHoldId);

      if (!released.ok) {
        setUiError(released.error || "No se pudo liberar la reserva");
        return;
      }

      setStep(2);
    } finally {
      setBusy(false);
    }
  }, [activeHoldId, busy, releaseTrackedHold]);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      return;
    }

    setIsVisible(false);

    const timeout = window.setTimeout(() => {
      setShouldRender(false);
      resetAll();
    }, MODAL_ANIMATION_MS);

    return () => window.clearTimeout(timeout);
  }, [open, resetAll]);

  useEffect(() => {
    if (!shouldRender) return;

    setIsVisible(false);

    const timeout = window.setTimeout(() => {
      setIsVisible(true);
    }, 10);

    return () => window.clearTimeout(timeout);
  }, [shouldRender, experience?.experienceId]);

  useEffect(() => {
    if (!shouldRender) return;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [shouldRender]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 transition-opacity duration-200 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`w-full max-w-xl origin-center overflow-hidden rounded-2xl bg-black text-white shadow-lg transition-transform duration-300 ease-out ${
          isVisible ? "scale-y-100" : "scale-y-[0.03]"
        }`}
      >
        <div
          className={`p-5 transition-opacity duration-200 ease-out ${
            isVisible ? "opacity-100 delay-150" : "opacity-0"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="pb-2">
              <div className="text-sm opacity-70">Reserva</div>
              <div className="text-lg font-semibold">
                {experience?.title ?? "Experiencia"}
              </div>
            </div>

            <button
              onClick={close}
              disabled={busy}
              className="rounded-xl border px-3 py-1 text-sm disabled:opacity-50"
            >
              Cerrar
            </button>
          </div>

          {experience && (
            <div className="relative mb-5 h-48 overflow-hidden rounded-2xl">
              <Image
                src={experience.imageSrc}
                alt={experience.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 672px"
                priority
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
            </div>
          )}

          <div className="mt-4 text-sm opacity-80">Paso {step} de 3</div>

          {uiError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {uiError}
            </div>
          )}

          {successMsg && (
            <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {successMsg}
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Adultos (mín. 1)
                  <input
                    type="number"
                    min={1}
                    value={adults}
                    onChange={(e) =>
                      setAdults(Math.max(1, Number(e.target.value)))
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                  />
                </label>

                <label className="text-sm">
                  Menores
                  <input
                    type="number"
                    min={0}
                    value={minors}
                    onChange={(e) =>
                      setMinors(Math.max(0, Number(e.target.value)))
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                  />
                </label>
              </div>

              <label className="text-sm block">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                />
              </label>

              <div className="flex justify-end">
                <button
                  className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                  disabled={!email.trim() || pax < 1 || !experienceId}
                  onClick={() => {
                    setUiError(null);
                    setSuccessMsg(null);
                    setStep(2);
                  }}
                >
                  Ver sesiones
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="mt-4 space-y-3 text-white">
              <div className="text-sm opacity-80">
                Plazas solicitadas: <span className="font-semibold">{pax}</span>
              </div>
              <div className="text-xs opacity-60">
                Disponibilidad actualizada automaticamente cada 2 segundos.
              </div>

              {loading && <div className="text-sm">Cargando sesiones…</div>}
              {error && <div className="text-sm text-red-700">{error}</div>}

              {!loading && !error && sessions.length === 0 && (
                <div className="text-sm opacity-80">
                  No hay sesiones disponibles.
                </div>
              )}

              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        {s.name && (
                          <div className="text-xs font-semibold uppercase tracking-wide opacity-60">
                            {s.name}
                          </div>
                        )}
                        <div className="font-semibold">
                          {formatDate(s.startAt)}
                        </div>
                        <div className="mt-1 text-sm opacity-80">
                          Libres: {s.freeSeats} / {s.maxSeatsTotal}
                        </div>
                      </div>

                      {s.canFit ? (
                        <button
                          className="rounded-xl bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
                          disabled={busy || !email.trim()}
                          onClick={() => void startHoldForSession(s)}
                        >
                          Reservar ahora
                        </button>
                      ) : (
                        <button
                          className="rounded-xl border px-3 py-2 text-sm"
                          disabled={busy || !email.trim()}
                          onClick={async () => {
                            setBusy(true);
                            setUiError(null);
                            setSuccessMsg(null);
                            try {
                              const res = await joinWaitlist({
                                sessionId: s.id,
                                customerEmail: email.trim(),
                                adultsCount: adults,
                                minorsCount: minors,
                              });

                              if (!res.ok) {
                                setUiError(
                                  res.error ||
                                    "No se pudo entrar en lista de espera",
                                );
                              } else {
                                setSuccessMsg(
                                  "Listo ✅ Te hemos apuntado a la lista de espera.",
                                );
                              }
                            } catch (e) {
                              setUiError(
                                e instanceof Error
                                  ? e.message
                                  : "Error desconocido",
                              );
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Avisarme
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <button
                  className="rounded-xl border px-4 py-2 text-sm"
                  onClick={() => setStep(1)}
                  disabled={busy}
                >
                  Atrás
                </button>
                <button
                  className="rounded-xl border px-4 py-2 text-sm disabled:opacity-50"
                  onClick={close}
                  disabled={busy}
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && selectedSession && (
            <div className="mt-4 space-y-3 text-white">
              <div className="rounded-2xl border p-4 text-sm">
                <div className="font-semibold">
                  {formatDate(selectedSession.startAt)}
                </div>
                <div className="mt-1 opacity-80">Plazas: {pax}</div>
              </div>

              <label className="text-sm block">
                Idioma de la ruta
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={tourLanguage}
                  onChange={(e) =>
                    setTourLanguage(e.target.value as LanguageBase)
                  }
                >
                  <option value="CA">Català</option>
                  <option value="ES">Castellano</option>
                  <option value="EN">English</option>
                </select>
              </label>

              <label className="text-sm block">
                Nombre y apellidos
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: Marc Espana"
                />
              </label>

              <label className="text-sm block">
                Teléfono (opcional)
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: +34 6XX XXX XXX"
                />
              </label>

              <div className="flex justify-between">
                <button
                  className="rounded-xl border px-4 py-2 text-sm"
                  onClick={goBackToSessions}
                  disabled={busy}
                >
                  Atrás
                </button>

                <button
                  className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                  disabled={busy || !email.trim() || !fullName.trim()}
                  onClick={async () => {
                    setBusy(true);
                    setUiError(null);
                    setSuccessMsg(null);
                    const holdReservationId = activeHoldId;

                    if (!holdReservationId) {
                      setUiError(
                        "La retencion ya no esta activa. Vuelve a elegir la sesion.",
                      );
                      setBusy(false);
                      return;
                    }

                    try {
                      const updatedHold = await updateHoldReservation({
                        reservationId: holdReservationId,
                        customerName: fullName.trim(),
                        customerPhone: phone.trim() ? phone.trim() : undefined,
                        tourLanguage,
                      });

                      if (!updatedHold.ok) {
                        setUiError(
                          updatedHold.error ||
                            "No se pudieron guardar los datos de la reserva",
                        );
                        return;
                      }

                      // Crear checkout de Stripe y redirigir
                      const checkout = await createCheckout({
                        reservationId: holdReservationId,
                      });

                      if (!checkout.ok) {
                        const releaseResult = await releaseTrackedHold(holdReservationId);
                        if (!releaseResult.ok) {
                          setUiError(
                            "No se pudo iniciar el pago y tampoco liberar la retencion. Se liberara automaticamente al expirar.",
                          );
                          return;
                        }

                        setUiError(checkout.error || "No se pudo iniciar el pago");
                        return;
                      }

                      window.location.href = checkout.checkoutUrl;
                    } catch (e) {
                      if (holdReservationId) {
                        const releaseResult = await releaseTrackedHold(holdReservationId);
                        if (!releaseResult.ok) {
                          setUiError(
                            "Se produjo un error y la retencion sigue activa unos minutos.",
                          );
                          return;
                        }
                      }

                      setUiError(
                        e instanceof Error ? e.message : "Error desconocido",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Ir a pagar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

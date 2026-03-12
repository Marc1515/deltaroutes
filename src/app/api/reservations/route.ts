// src/app/api/reservations/route.ts
import "dotenv/config";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, LanguageCode, ReservationStatus, PaymentStatus } from "@/generated/prisma";
import { HOLD_MINUTES } from "@/config/app";
import type { CreateReservationBody, CreateReservationResponse } from "@/types/reservations.types";
import { sendEmail } from "@/lib/email";
import ReservationCreatedHoldEmail from "@/emails/ReservationCreatedHoldEmail";
import ReservationWaitingEmail from "@/emails/ReservationWaitingEmail";

const madridFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  dateStyle: "short",
  timeStyle: "short",
});

/**
 * Detecta idioma principal del navegador desde Accept-Language.
 * Lo usamos SOLO como preferencia interna (no obliga el idioma del tour).
 */
function detectBrowserLanguage(req: Request): LanguageCode | null {
  const header = req.headers.get("accept-language");
  if (!header) return null;

  const first = header.split(",")[0]?.trim().toLowerCase();
  if (!first) return null;

  const code = first.split("-")[0];

  switch (code) {
    case "ca":
      return LanguageCode.CA;
    case "es":
      return LanguageCode.ES;
    case "en":
      return LanguageCode.EN;
    case "de":
      return LanguageCode.DE;
    case "fr":
      return LanguageCode.FR;
    case "it":
      return LanguageCode.IT;
    default:
      return null;
  }
}

/**
 * Devuelve true si el idioma es uno de los 3 base.
 * Si detectamos CA/ES/EN en el navegador, no aporta nada para elegir guía
 * porque todos los guías dominan esos 3 por contrato.
 */
function isBaseLanguage(lng: LanguageCode) {
  return lng === LanguageCode.CA || lng === LanguageCode.ES || lng === LanguageCode.EN;
}

function toInt(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

const MAX_SERIALIZABLE_RETRIES = 3;

function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60_000);
}

function isSerializationError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const msg = e.message.toLowerCase();
  return msg.includes("serialization") || msg.includes("could not serialize");
}

function isDuplicateReservationError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function canReuseReservationStatus(status: ReservationStatus) {
  return status === ReservationStatus.EXPIRED || status === ReservationStatus.CANCELLED;
}

async function attemptCreateReservation(args: {
  body: CreateReservationBody;
  adultsCount: number;
  minorsCount: number;
  totalPax: number;
  browserLanguage: LanguageCode | null;
}) {
  const { body, adultsCount, minorsCount, totalPax, browserLanguage } = args;
  const now = new Date();

  return prisma.$transaction(
    async (tx) => {
      const session = await tx.session.findUniqueOrThrow({
        where: { id: body.sessionId },
      });

      if (session.isCancelled) {
        return { ok: false as const, status: 400, error: "Session is cancelled" };
      }

      if (now > session.bookingClosesAt) {
        return { ok: false as const, status: 400, error: "Booking is closed for this session" };
      }

      const customer = await tx.customer.upsert({
        where: { email: body.customerEmail },
        update: {
          name: body.customerName ?? undefined,
          phone: body.customerPhone ?? undefined,
        },
        create: {
          name: body.customerName ?? null,
          email: body.customerEmail,
          phone: body.customerPhone ?? null,
        },
      });

      const existing = await tx.reservation.findUnique({
        where: { sessionId_customerId: { sessionId: session.id, customerId: customer.id } },
        include: { payment: true },
      });

      if (existing && !canReuseReservationStatus(existing.status)) {
        return {
          ok: false as const,
          status: 409,
          error: "Customer already has a reservation for this session",
        };
      }

      const reusableReservation = existing && canReuseReservationStatus(existing.status) ? existing : null;

      const paymentData = session.requiresPayment
        ? {
            status: PaymentStatus.REQUIRES_PAYMENT,
            amountCents:
              adultsCount * session.adultPriceCents + minorsCount * session.minorPriceCents,
            currency: session.currency,
            stripeCheckoutSessionId: null,
            stripePaymentIntentId: null,
          }
        : {
            status: PaymentStatus.NOT_REQUIRED,
            amountCents: 0,
            currency: session.currency,
            stripeCheckoutSessionId: null,
            stripePaymentIntentId: null,
          };

      const reservedAgg = await tx.reservation.aggregate({
        where: {
          sessionId: session.id,
          OR: [
            { status: ReservationStatus.CONFIRMED },
            { status: ReservationStatus.HOLD, holdExpiresAt: { gt: now } },
          ],
        },
        _sum: { totalPax: true },
      });

      const reservedSeats = reservedAgg._sum.totalPax ?? 0;
      const freeSeats = Math.max(0, session.maxSeatsTotal - reservedSeats);

      if (freeSeats < totalPax) {
        const waiting = reusableReservation
          ? await tx.reservation.update({
              where: { id: reusableReservation.id },
              data: {
                guideUserId: null,
                status: ReservationStatus.WAITING,
                holdExpiresAt: null,
                tourLanguage: body.tourLanguage ?? null,
                browserLanguage,
                adultsCount,
                minorsCount,
                totalPax,
                cancelledAt: null,
                cancelReason: null,
                refundAmountCents: 0,
                createdEmailSentAt: null,
                createdEmailKind: null,
              },
            })
          : await tx.reservation.create({
              data: {
                sessionId: session.id,
                customerId: customer.id,
                status: ReservationStatus.WAITING,
                tourLanguage: body.tourLanguage ?? null,
                browserLanguage,
                adultsCount,
                minorsCount,
                totalPax,
              },
            });

        if (reusableReservation?.payment) {
          await tx.payment.update({
            where: { id: reusableReservation.payment.id },
            data: { status: PaymentStatus.CANCELED, stripeCheckoutSessionId: null, stripePaymentIntentId: null },
          });
        }

        return { ok: true as const, kind: "WAITING" as const, reservationId: waiting.id };
      }

      const candidateGuides = await tx.user.findMany({
        where: { role: "GUIDE", isActive: true },
        select: { id: true, languages: true },
      });

      if (candidateGuides.length === 0) {
        const waiting = reusableReservation
          ? await tx.reservation.update({
              where: { id: reusableReservation.id },
              data: {
                guideUserId: null,
                status: ReservationStatus.WAITING,
                holdExpiresAt: null,
                tourLanguage: body.tourLanguage ?? null,
                browserLanguage,
                adultsCount,
                minorsCount,
                totalPax,
                cancelledAt: null,
                cancelReason: null,
                refundAmountCents: 0,
                createdEmailSentAt: null,
                createdEmailKind: null,
              },
            })
          : await tx.reservation.create({
              data: {
                sessionId: session.id,
                customerId: customer.id,
                status: ReservationStatus.WAITING,
                tourLanguage: body.tourLanguage ?? null,
                browserLanguage,
                adultsCount,
                minorsCount,
                totalPax,
              },
            });

        if (reusableReservation?.payment) {
          await tx.payment.update({
            where: { id: reusableReservation.payment.id },
            data: { status: PaymentStatus.CANCELED, stripeCheckoutSessionId: null, stripePaymentIntentId: null },
          });
        }

        return { ok: true as const, kind: "WAITING" as const, reservationId: waiting.id };
      }

      const preferredGuides =
        browserLanguage && !isBaseLanguage(browserLanguage)
          ? candidateGuides.filter((g) => g.languages.includes(browserLanguage))
          : [];

      async function pickLeastLoaded(guideIds: string[]): Promise<string | null> {
        if (guideIds.length === 0) return null;

        const loads = await tx.reservation.groupBy({
          by: ["guideUserId"],
          where: {
            sessionId: session.id,
            OR: [
              { status: ReservationStatus.CONFIRMED },
              { status: ReservationStatus.HOLD, holdExpiresAt: { gt: now } },
            ],
            guideUserId: { in: guideIds },
          },
          _sum: { totalPax: true },
        });

        const loadMap = new Map<string, number>();
        for (const row of loads) {
          if (row.guideUserId) loadMap.set(row.guideUserId, row._sum.totalPax ?? 0);
        }

        const sorted = guideIds
          .map((id) => ({ id, load: loadMap.get(id) ?? 0 }))
          .sort((a, b) => a.load - b.load);

        const chosen = sorted.find((g) => g.load + totalPax <= session.maxPerGuide);
        return chosen?.id ?? null;
      }

      let guideUserId: string | null = await pickLeastLoaded(preferredGuides.map((g) => g.id));
      if (!guideUserId) {
        guideUserId = await pickLeastLoaded(candidateGuides.map((g) => g.id));
      }

      if (!guideUserId) {
        const waiting = reusableReservation
          ? await tx.reservation.update({
              where: { id: reusableReservation.id },
              data: {
                guideUserId: null,
                status: ReservationStatus.WAITING,
                holdExpiresAt: null,
                tourLanguage: body.tourLanguage ?? null,
                browserLanguage,
                adultsCount,
                minorsCount,
                totalPax,
                cancelledAt: null,
                cancelReason: null,
                refundAmountCents: 0,
                createdEmailSentAt: null,
                createdEmailKind: null,
              },
            })
          : await tx.reservation.create({
              data: {
                sessionId: session.id,
                customerId: customer.id,
                status: ReservationStatus.WAITING,
                tourLanguage: body.tourLanguage ?? null,
                browserLanguage,
                adultsCount,
                minorsCount,
                totalPax,
              },
            });

        if (reusableReservation?.payment) {
          await tx.payment.update({
            where: { id: reusableReservation.payment.id },
            data: { status: PaymentStatus.CANCELED, stripeCheckoutSessionId: null, stripePaymentIntentId: null },
          });
        }

        return { ok: true as const, kind: "WAITING" as const, reservationId: waiting.id };
      }

      const holdExpiresAt = addMinutes(now, HOLD_MINUTES + 1);

      const reservation = reusableReservation
        ? await tx.reservation.update({
            where: { id: reusableReservation.id },
            data: {
              guideUserId,
              status: ReservationStatus.HOLD,
              holdExpiresAt,
              tourLanguage: body.tourLanguage ?? null,
              browserLanguage,
              adultsCount,
              minorsCount,
              totalPax,
              cancelledAt: null,
              cancelReason: null,
              refundAmountCents: 0,
              createdEmailSentAt: null,
              createdEmailKind: null,
            },
          })
        : await tx.reservation.create({
            data: {
              sessionId: session.id,
              customerId: customer.id,
              guideUserId,
              status: ReservationStatus.HOLD,
              holdExpiresAt,
              tourLanguage: body.tourLanguage ?? null,
              browserLanguage,
              adultsCount,
              minorsCount,
              totalPax,
            },
          });

      if (reusableReservation?.payment) {
        await tx.payment.update({
          where: { id: reusableReservation.payment.id },
          data: paymentData,
        });
      } else {
        await tx.payment.create({
          data: {
            reservationId: reservation.id,
            ...paymentData,
          },
        });
      }

      return {
        ok: true as const,
        kind: "HOLD" as const,
        reservationId: reservation.id,
        holdExpiresAt: madridFormatter.format(holdExpiresAt),
      };
    },
    { isolationLevel: "Serializable" },
  );
}

export async function POST(req: Request) {
  /**
   * Mantenemos el type actual (CreateReservationBody), pero el body real incluye pax.
   * Lo leemos desde "raw" para no bloquearte por tipos mientras ajustas los types del front.
   */
  const raw = (await req.json()) as Record<string, unknown>;
  const body = raw as CreateReservationBody;

  // Pax (nuevo flujo)
  const adultsCount = toInt(raw.adultsCount);
  const minorsCount = toInt(raw.minorsCount);

  if (!body.sessionId || !body.customerEmail) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validación de pax: adultos >= 1, menores >= 0
  if (!Number.isFinite(adultsCount) || adultsCount < 1) {
    return NextResponse.json({ error: "adultsCount must be a number >= 1" }, { status: 400 });
  }
  if (!Number.isFinite(minorsCount) || minorsCount < 0) {
    return NextResponse.json({ error: "minorsCount must be a number >= 0" }, { status: 400 });
  }

  const totalPax = adultsCount + minorsCount;

  const browserLanguage = detectBrowserLanguage(req);

  try {
    let result:
      | (CreateReservationResponse & { ok: true; reservationId: string })
      | { ok: false; status: number; error: string }
      | null = null;

    for (let i = 0; i < MAX_SERIALIZABLE_RETRIES; i++) {
      try {
        result = await attemptCreateReservation({
          body,
          adultsCount,
          minorsCount,
          totalPax,
          browserLanguage,
        });
        break;
      } catch (e: unknown) {
        if (isSerializationError(e) && i < MAX_SERIALIZABLE_RETRIES - 1) {
          continue;
        }

        if (isDuplicateReservationError(e)) {
          return NextResponse.json(
            { error: "Customer already has a reservation for this session" },
            { status: 409 },
          );
        }

        throw e;
      }
    }

    if (!result) {
      return NextResponse.json(
        { error: "Could not create reservation due to concurrent updates" },
        { status: 409 },
      );
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // =========================
    // EMAIL (best-effort)
    // =========================
    try {
      const fullReservation = await prisma.reservation.findUnique({
        where: { id: result.reservationId },
        include: { customer: true, session: true },
      });

      if (fullReservation) {
        const toEmail = fullReservation.customer.email;
        if (toEmail) {
          const appUrl = process.env.APP_URL ?? "http://localhost:3000";
          const reservationCode = `DR-${fullReservation.id.slice(0, 8).toUpperCase()}`;

          // TODO: si quieres algo más friendly, usa session.experience.title en lugar de "Sesión XXXXX"
          const activityLabel = `Sesión ${fullReservation.sessionId.slice(0, 8).toUpperCase()}`;

          // Usamos startAt (no bookingClosesAt)
          const startText = madridFormatter.format(fullReservation.session.startAt);

          // Compat: tu email de HOLD aún incluye idioma
          const languageLabel = fullReservation.tourLanguage ?? body.tourLanguage ?? "Pendiente";

          // Idempotencia: solo 1 email "created" por reserva
          const mark = await prisma.reservation.updateMany({
            where: { id: fullReservation.id, createdEmailSentAt: null },
            data: {
              createdEmailSentAt: new Date(),
              createdEmailKind: result.kind, // "HOLD" | "WAITING"
            },
          });

          if (mark.count === 1) {
            if (result.kind === "HOLD") {
              const payUrl = `${appUrl}/checkout/start?reservationId=${fullReservation.id}`;

              await sendEmail({
                to: toEmail,
                subject: `DeltaRoutes · Reserva iniciada (${reservationCode})`,
                react: ReservationCreatedHoldEmail({
                  customerName: fullReservation.customer.name ?? "Cliente",
                  activityLabel,
                  startText,
                  languageLabel,
                  payUrl,
                  holdMinutes: HOLD_MINUTES,
                  reservationCode,
                }),
              });
            } else if (result.kind === "WAITING") {
              await sendEmail({
                to: toEmail,
                subject: `DeltaRoutes · Lista de espera (${reservationCode})`,
                react: ReservationWaitingEmail({
                  customerName: fullReservation.customer.name ?? "Cliente",
                  activityLabel,
                  startText,
                  reservationCode,
                  adultsCount: fullReservation.adultsCount,
                  minorsCount: fullReservation.minorsCount,
                  totalPax: fullReservation.totalPax,
                }),
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn("Reservation email failed:", e);
    }

    return NextResponse.json(result as CreateReservationResponse);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";

    if (message.includes("No Session found")) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

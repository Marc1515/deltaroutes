// src/app/api/reservations/route.ts
import "dotenv/config";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  LanguageCode,
  ReservationStatus,
  PaymentStatus,
} from "@/generated/prisma";
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
 * (Si detectamos CA/ES/EN en el navegador, no aporta nada para elegir guía,
 * porque todos los guías dominan los 3 por contrato.)
 */
function isBaseLanguage(lng: LanguageCode) {
  return lng === LanguageCode.CA || lng === LanguageCode.ES || lng === LanguageCode.EN;
}

export async function POST(req: Request) {
  const body = (await req.json()) as CreateReservationBody;

  if (!body.sessionId || !body.customerName || !body.customerEmail || !body.tourLanguage) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const now = new Date();

  // Idioma del navegador: solo para preferir guía “especial”
  const browserLanguage = detectBrowserLanguage(req);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.session.findUniqueOrThrow({
        where: { id: body.sessionId },
      });

      // reglas de negocio
      if (session.isCancelled) {
        return { ok: false as const, status: 400, error: "Session is cancelled" };
      }

      if (now > session.bookingClosesAt) {
        return { ok: false as const, status: 400, error: "Booking is closed for this session" };
      }

      // Customer: email obligatorio -> upsert
      const customer = await tx.customer.upsert({
        where: { email: body.customerEmail },
        update: { name: body.customerName, phone: body.customerPhone ?? undefined },
        create: { name: body.customerName, email: body.customerEmail, phone: body.customerPhone ?? null },
      });

      // evitar duplicado
      const existing = await tx.reservation.findUnique({
        where: { sessionId_customerId: { sessionId: session.id, customerId: customer.id } },
      });

      if (existing) {
        return { ok: false as const, status: 409, error: "Customer already has a reservation for this session" };
      }

      // plazas ocupadas globales
      const taken = await tx.reservation.count({
        where: {
          sessionId: session.id,
          status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.HOLD] },
        },
      });

      if (taken >= session.maxSeatsTotal) {
        const waiting = await tx.reservation.create({
          data: {
            sessionId: session.id,
            customerId: customer.id,
            status: ReservationStatus.WAITING,
            tourLanguage: body.tourLanguage,
            browserLanguage, // interno (puede ser null)
          },
        });

        return { ok: true as const, kind: "WAITING" as const, reservationId: waiting.id };
      }

      /**
       * Asignación de guía (refinada):
       * - No comprobamos tourLanguage en guide.languages porque TODOS los guías dominan CA/ES/EN.
       * - Solo usamos browserLanguage si es un idioma “extra” (DE/FR/IT...) para preferir guías especiales.
       */
      const candidateGuides = await tx.user.findMany({
        where: { role: "GUIDE", isActive: true },
        select: { id: true, languages: true },
      });

      if (candidateGuides.length === 0) {
        // Sin guías -> WAITING (o podrías devolver error según negocio)
        const waiting = await tx.reservation.create({
          data: {
            sessionId: session.id,
            customerId: customer.id,
            status: ReservationStatus.WAITING,
            tourLanguage: body.tourLanguage,
            browserLanguage,
          },
        });

        return { ok: true as const, kind: "WAITING" as const, reservationId: waiting.id };
      }

      // Si browserLanguage es base, no aporta nada; si es extra, intentamos preferir guía que lo tenga
      const preferredGuides =
        browserLanguage && !isBaseLanguage(browserLanguage)
          ? candidateGuides.filter((g) => g.languages.includes(browserLanguage))
          : [];

      async function pickLeastLoaded(guideIds: string[]): Promise<string | null> {
        if (guideIds.length === 0) return null;

        const counts = await tx.reservation.groupBy({
          by: ["guideUserId"],
          where: {
            sessionId: session.id,
            status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.HOLD] },
            guideUserId: { in: guideIds },
          },
          _count: { _all: true },
        });

        const countMap = new Map<string, number>();
        for (const row of counts) {
          if (row.guideUserId) countMap.set(row.guideUserId, row._count._all);
        }

        const sorted = guideIds
          .map((id) => ({ id, load: countMap.get(id) ?? 0 }))
          .sort((a, b) => a.load - b.load);

        const chosen = sorted.find((g) => g.load < session.maxPerGuide);
        return chosen?.id ?? null;
      }

      // 1º: guía “especial” (si aplica) | 2º: cualquiera
      let guideUserId: string | null = await pickLeastLoaded(preferredGuides.map((g) => g.id));
      if (!guideUserId) {
        guideUserId = await pickLeastLoaded(candidateGuides.map((g) => g.id));
      }

      if (!guideUserId) {
        // No hay guía con hueco -> WAITING
        const waiting = await tx.reservation.create({
          data: {
            sessionId: session.id,
            customerId: customer.id,
            status: ReservationStatus.WAITING,
            tourLanguage: body.tourLanguage,
            browserLanguage,
          },
        });

        return { ok: true as const, kind: "WAITING" as const, reservationId: waiting.id };
      }

      // HOLD
      const holdExpiresAt = new Date(now.getTime() + (HOLD_MINUTES + 1) * 60 * 1000);


      const reservation = await tx.reservation.create({
        data: {
          sessionId: session.id,
          customerId: customer.id,
          guideUserId,
          status: ReservationStatus.HOLD,
          holdExpiresAt,
          tourLanguage: body.tourLanguage,
          browserLanguage,
        },
      });

      // Payment placeholder
      if (session.requiresPayment) {
        await tx.payment.create({
          data: {
            reservationId: reservation.id,
            status: PaymentStatus.REQUIRES_PAYMENT,
            amountCents: session.priceCents,
            currency: session.currency,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            reservationId: reservation.id,
            status: PaymentStatus.NOT_REQUIRED,
            amountCents: 0,
            currency: session.currency,
          },
        });
      }

      return { ok: true as const, kind: "HOLD" as const, reservationId: reservation.id, holdExpiresAt: madridFormatter.format(holdExpiresAt) };
    });

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

        // Si no hay email (null), simplemente no enviamos nada (pero NO salimos del endpoint)
        if (toEmail) {
          const appUrl = process.env.APP_URL ?? "http://localhost:3000";
          const reservationCode = fullReservation.id.slice(0, 8).toUpperCase();

          const activityLabel = `Sesión ${fullReservation.sessionId.slice(0, 8).toUpperCase()}`;
          const languageLabel = fullReservation.tourLanguage;
          const startText = madridFormatter.format(fullReservation.session.bookingClosesAt);

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
                languageLabel,
                reservationCode,
              }),
            });
          }
        }
      }
    } catch (e) {
      console.warn("Reservation email failed:", e);
    }


    // Respuesta normal
    return NextResponse.json(result as CreateReservationResponse);

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";

    if (message.includes("No Session found")) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

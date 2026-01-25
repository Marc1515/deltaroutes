// src/app/api/reservations/route.ts
import "dotenv/config";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  LanguageBase,
  LanguageCode,
  ReservationStatus,
  PaymentStatus,
} from "@/generated/prisma";

/**
 * Body esperado en el POST /api/reservations
 *
 * - sessionId: la sesión concreta (fecha/hora) a reservar
 * - customerName/email/phone: datos del cliente (sin cuenta)
 * - tourLanguage: idioma principal del tour (el cliente elige 1) -> CA/ES/EN
 */
type Body = {
  sessionId: string;
  customerName: string;
  customerEmail: string; // 👈 obligatorio como acordaste
  customerPhone?: string;
  tourLanguage: LanguageBase; // CA | ES | EN
};

const HOLD_MINUTES = 15;

/**
 * Convierte LanguageBase (CA/ES/EN) a LanguageCode (CA/ES/EN/DE/FR/IT).
 * Comparten valores, pero TS necesita conversión explícita.
 */
function baseToCode(l: LanguageBase): LanguageCode {
  return l as unknown as LanguageCode;
}

/**
 * Intenta detectar el idioma principal del navegador (Accept-Language)
 * y mapearlo a tu enum LanguageCode.
 *
 * Ejemplos de Accept-Language:
 * - "es-ES,es;q=0.9,en;q=0.8"
 * - "de-DE,de;q=0.9,en;q=0.8"
 */
function detectBrowserLanguage(req: Request): LanguageCode | null {
  const header = req.headers.get("accept-language");
  if (!header) return null;

  // Nos quedamos con el primer idioma “fuerte” antes de coma:
  // "es-ES" de "es-ES,es;q=0.9,en;q=0.8"
  const first = header.split(",")[0]?.trim().toLowerCase();
  if (!first) return null;

  // Normalizamos a código base: "es" de "es-es"
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

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  // Validación mínima
  if (!body.sessionId || !body.customerName || !body.customerEmail || !body.tourLanguage) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const now = new Date();

  // Detectamos idioma del navegador (solo para preselección/análisis/preferencia de guía)
  const browserLanguage = detectBrowserLanguage(req);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) Traer sesión
      const session = await tx.session.findUniqueOrThrow({
        where: { id: body.sessionId },
        include: { experience: true },
      });

      // 2) Reglas de negocio
      if (session.isCancelled) {
        return { ok: false as const, status: 400, error: "Session is cancelled" };
      }

      if (now > session.bookingClosesAt) {
        return { ok: false as const, status: 400, error: "Booking is closed for this session" };
      }

      // 3) Customer: email obligatorio -> upsert
      const customer = await tx.customer.upsert({
        where: { email: body.customerEmail },
        update: { name: body.customerName, phone: body.customerPhone ?? undefined },
        create: { name: body.customerName, email: body.customerEmail, phone: body.customerPhone ?? null },
      });

      // 4) Evitar doble reserva del mismo customer en la misma sesión
      const existing = await tx.reservation.findUnique({
        where: { sessionId_customerId: { sessionId: session.id, customerId: customer.id } },
      });

      if (existing) {
        return { ok: false as const, status: 409, error: "Customer already has a reservation for this session" };
      }

      // 5) Contar plazas ocupadas (CONFIRMED + HOLD)
      const taken = await tx.reservation.count({
        where: {
          sessionId: session.id,
          status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.HOLD] },
        },
      });

      // Si no hay plazas -> WAITING (sin guía asignado)
      if (taken >= session.maxSeatsTotal) {
        const waiting = await tx.reservation.create({
          data: {
            sessionId: session.id,
            customerId: customer.id,
            status: ReservationStatus.WAITING,
            tourLanguage: body.tourLanguage,
            browserLanguage, // interno: puede ser null
          },
        });

        return { ok: true as const, kind: "WAITING" as const, reservationId: waiting.id };
      }

      // 6) Asignación de guía
      // Requisito: guía debe dominar el idioma del tour (tourLanguage)
      const tourLanguageAsCode = baseToCode(body.tourLanguage);

      // Candidatos: guías activos que dominen tourLanguage
      const candidateGuides = await tx.user.findMany({
        where: {
          role: "GUIDE",
          isActive: true,
          languages: { has: tourLanguageAsCode },
        },
        select: { id: true, languages: true },
      });

      if (candidateGuides.length === 0) {
        // No hay guías capaces de hacer el tour en ese idioma
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

      // Queremos preferir guías que (además) dominen el idioma del navegador, si existe
      // (pero sin que sea obligatorio)
      const preferredGuides =
        browserLanguage
          ? candidateGuides.filter((g) => g.languages.includes(browserLanguage))
          : [];

      /**
       * Dado un set de guías, devuelve el que tenga menos carga en esta sesión
       * y no supere maxPerGuide. Si ninguno tiene hueco -> null.
       */
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

      // 1º intento: guías que también dominen browserLanguage (si existe)
      let guideUserId: string | null = null;
      guideUserId = await pickLeastLoaded(preferredGuides.map((g) => g.id));

      // 2º intento: cualquier guía que domine tourLanguage
      if (!guideUserId) {
        guideUserId = await pickLeastLoaded(candidateGuides.map((g) => g.id));
      }

      // Si no hay guía con hueco -> WAITING
      if (!guideUserId) {
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

      // 7) Crear HOLD
      const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);

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

      // 8) Payment placeholder (Stripe vendrá luego)
      if (session.requiresPayment) {
        await tx.payment.create({
          data: {
            reservationId: reservation.id,
            status: PaymentStatus.PENDING,
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

      return {
        ok: true as const,
        kind: "HOLD" as const,
        reservationId: reservation.id,
        holdExpiresAt,
      };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";

    // findUniqueOrThrow lanza algo tipo: "No Session found..."
    if (message.includes("No Session found")) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

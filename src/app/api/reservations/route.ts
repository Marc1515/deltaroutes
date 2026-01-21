// src/app/api/reservations/route.ts

// Nota:
// - Esto es un "Route Handler" (App Router) de Next.js.
// - Se ejecuta en el servidor (Node), no en el navegador.
// - Recibe un POST con datos del cliente y crea una reserva.

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
 * - primaryLanguage: idioma base que siempre ofrecemos (CA/ES/EN)
 * - preferredLanguage: opcional (DE/FR/IT...) para intentar asignar guía compatible si existe
 */
type Body = {
  sessionId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  primaryLanguage: LanguageBase; // CA | ES | EN
  preferredLanguage?: LanguageCode; // opcional (DE/FR/IT...)
};

/**
 * Duración del "HOLD" (reserva retenida) antes de expirar.
 * Esto simula el tiempo máximo para completar el pago.
 */
const HOLD_MINUTES = 15;

/**
 * LanguageBase (CA/ES/EN) es un subset de LanguageCode (CA/ES/EN/DE/FR/IT).
 * Como comparten los mismos strings, convertimos explícitamente el tipo para TS.
 */
function baseToCode(l: LanguageBase): LanguageCode {
  return l as unknown as LanguageCode;
}

export async function POST(req: Request) {
  // 1) Leemos el JSON del request
  const body = (await req.json()) as Body;

  // 2) Validación mínima (si faltan campos obligatorios -> 400)
  if (!body.sessionId || !body.customerName || !body.primaryLanguage) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Guardamos 'now' para comparar con bookingClosesAt y crear expiraciones
  const now = new Date();

  try {
    /**
     * 3) Transacción:
     *    Todo lo que hagamos dentro debe ser atómico:
     *    o se crea TODO bien, o no se crea nada.
     *
     *    Esto es importante porque aquí comprobamos plazas,
     *    asignamos guía y creamos reserva. Queremos evitar "race conditions".
     */
    const result = await prisma.$transaction(async (tx) => {
      /**
       * 4) Cargar la sesión (día/hora concreta).
       * findUniqueOrThrow:
       *  - si no existe lanza error automáticamente (así evitamos "session posiblemente null")
       */
      const session = await tx.session.findUniqueOrThrow({
        where: { id: body.sessionId },
        include: { experience: true }, // no es obligatorio para la lógica actual, pero puede ser útil
      });

      /**
       * 5) Reglas de negocio para permitir reservar
       */

      // Si la sesión está cancelada (por la empresa) -> no dejamos reservar
      if (session.isCancelled) {
        return { ok: false as const, status: 400, error: "Session is cancelled" };
      }

      // Si ya pasó la hora de cierre (startAt - 4 horas) -> no dejamos reservar
      if (now > session.bookingClosesAt) {
        return {
          ok: false as const,
          status: 400,
          error: "Booking is closed for this session",
        };
      }

      /**
       * 6) Crear o reutilizar Customer (clientes SIN cuenta)
       *
       * Si hay email, hacemos upsert:
       * - si existe el customer con ese email, actualizamos nombre/phone
       * - si no existe, lo creamos
       *
       * IMPORTANTE:
       * Para que esto compile, Customer.email debe ser @unique en schema.prisma.
       */
      const customer = body.customerEmail
        ? await tx.customer.upsert({
          where: { email: body.customerEmail },
          update: {
            name: body.customerName,
            phone: body.customerPhone ?? undefined,
          },
          create: {
            name: body.customerName,
            email: body.customerEmail,
            phone: body.customerPhone ?? null,
          },
        })
        : await tx.customer.create({
          data: {
            name: body.customerName,
            phone: body.customerPhone ?? null,
            email: null,
          },
        });

      /**
       * 7) Evitar que el mismo customer reserve dos veces la misma sesión.
       * Esto se apoya en tu constraint @@unique([sessionId, customerId]).
       *
       * Aquí lo comprobamos manualmente para devolver un 409 bonito.
       */
      const existing = await tx.reservation.findUnique({
        where: {
          sessionId_customerId: { sessionId: session.id, customerId: customer.id },
        },
      });
      if (existing) {
        return {
          ok: false as const,
          status: 409,
          error: "Customer already has a reservation for this session",
        };
      }

      /**
       * 8) Contar plazas ocupadas:
       * Consideramos ocupadas:
       *  - CONFIRMED (pagadas)
       *  - HOLD (retenidas temporalmente)
       *
       * WAITING no ocupa plaza.
       */
      const taken = await tx.reservation.count({
        where: {
          sessionId: session.id,
          status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.HOLD] },
        },
      });

      /**
       * 9) Si no hay plazas globales -> WAITING
       * Aquí todavía creamos una reserva "WAITING" para el cliente.
       * (Luego se promocionará si alguien cancela)
       */
      if (taken >= session.maxSeatsTotal) {
        const waiting = await tx.reservation.create({
          data: {
            sessionId: session.id,
            customerId: customer.id,
            status: ReservationStatus.WAITING,
            primaryLanguage: body.primaryLanguage,
            preferredLanguage: body.preferredLanguage ?? null,
          },
        });

        return {
          ok: true as const,
          kind: "WAITING" as const,
          reservationId: waiting.id,
        };
      }

      /**
       * 10) Asignación de guía:
       * - intentamos el preferredLanguage primero (si existe)
       * - si no, fallback al primaryLanguage (CA/ES/EN)
       *
       * Primero convertimos el primaryLanguage a LanguageCode (porque User.languages es LanguageCode[])
       */
      const primaryAsCode = baseToCode(body.primaryLanguage);

      // Lista de idiomas a intentar en orden de preferencia
      const tryLanguages: LanguageCode[] = [];
      if (body.preferredLanguage) tryLanguages.push(body.preferredLanguage);
      tryLanguages.push(primaryAsCode);

      /**
       * Candidatos: guías activos que tengan al menos uno de los idiomas.
       * Luego elegiremos el que tenga menos carga (menos reservas) y no supere maxPerGuide.
       */
      const candidateGuides = await tx.user.findMany({
        where: {
          role: "GUIDE",
          isActive: true,
          OR: tryLanguages.map((lng) => ({ languages: { has: lng } })),
        },
        select: { id: true, languages: true },
      });

      /**
       * Helper: dado un idioma, elige el guía con ese idioma
       * y que tenga hueco (< maxPerGuide) en esa sesión.
       */
      async function pickGuideForLanguage(lang: LanguageCode) {
        // Filtramos guías que realmente tengan ese idioma
        const guides = candidateGuides.filter((g) => g.languages.includes(lang));
        if (guides.length === 0) return null;

        /**
         * Contamos reservas por guía dentro de esta sesión.
         * groupBy devuelve algo tipo:
         *  [{ guideUserId: "x", _count: { _all: 2 } }, ...]
         */
        const counts = await tx.reservation.groupBy({
          by: ["guideUserId"],
          where: {
            sessionId: session.id,
            status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.HOLD] },
            guideUserId: { in: guides.map((g) => g.id) },
          },
          _count: { _all: true },
        });

        // Convertimos esa lista a un mapa: guideId -> count
        const countMap = new Map<string, number>();
        for (const row of counts) {
          if (row.guideUserId) countMap.set(row.guideUserId, row._count._all);
        }

        // Ordenamos guías por carga (menos reservas primero)
        const sorted = guides
          .map((g) => ({ id: g.id, load: countMap.get(g.id) ?? 0 }))
          .sort((a, b) => a.load - b.load);

        // Elegimos el primero que tenga carga < maxPerGuide
        const chosen = sorted.find((g) => g.load < session.maxPerGuide);
        return chosen?.id ?? null;
      }

      // Intentamos guía con idioma preferido y luego idioma base
      let guideUserId: string | null = null;

      if (body.preferredLanguage) {
        guideUserId = await pickGuideForLanguage(body.preferredLanguage);
      }
      if (!guideUserId) {
        guideUserId = await pickGuideForLanguage(primaryAsCode);
      }

      /**
       * 11) Si no hay guía disponible, aunque haya plazas globales,
       * entramos en WAITING.
       *
       * Esto pasa si, por ejemplo:
       * - maxPerGuide es 6
       * - ya están llenos todos los guías para esa sesión
       */
      if (!guideUserId) {
        const waiting = await tx.reservation.create({
          data: {
            sessionId: session.id,
            customerId: customer.id,
            status: ReservationStatus.WAITING,
            primaryLanguage: body.primaryLanguage,
            preferredLanguage: body.preferredLanguage ?? null,
          },
        });

        return {
          ok: true as const,
          kind: "WAITING" as const,
          reservationId: waiting.id,
        };
      }

      /**
       * 12) Crear reserva HOLD (plaza retenida)
       * holdExpiresAt = now + 15 minutos
       */
      const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);

      const reservation = await tx.reservation.create({
        data: {
          sessionId: session.id,
          customerId: customer.id,
          guideUserId,
          status: ReservationStatus.HOLD,
          holdExpiresAt,
          primaryLanguage: body.primaryLanguage,
          preferredLanguage: body.preferredLanguage ?? null,
        },
      });

      /**
       * 13) Crear Payment "placeholder"
       * Todavía NO hay Stripe en este endpoint.
       * En la siguiente fase:
       * - aquí crearemos Stripe Checkout Session
       * - guardaremos stripeCheckoutSessionId / paymentIntentId
       * - y el webhook de Stripe hará:
       *     Payment.SUCCEEDED + Reservation.CONFIRMED
       */
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

      // Respuesta final de éxito: HOLD
      return {
        ok: true as const,
        kind: "HOLD" as const,
        reservationId: reservation.id,
        holdExpiresAt,
      };
    });

    /**
     * 14) Fuera de la transacción: devolvemos respuesta HTTP al cliente.
     * Si ok=false, devolvemos error con el status correspondiente.
     */
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    /**
     * 15) Error handler general
     * - Si findUniqueOrThrow no encuentra sesión, Prisma lanza error.
     * - De momento detectamos por texto (más adelante lo refinamos por error code).
     */
    const message = e instanceof Error ? e.message : "Unknown error";

    if (message.includes("No Session found")) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
